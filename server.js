if (process.env.NODE_ENV !== "production") {
    {
        require('dotenv').config();
    }
}

const express = require('express');
const mongoose = require('mongoose');

const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const methodOverride = require('method-override');
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const deepl = require('deepl-node');
const translator = new deepl.Translator(process.env.DEEPL_API_KEY);

const cloudinary = require('./cloudinary');
const { v4: uuidv4 } = require('uuid');


const User = require('./models/user');
const Diary = require('./models/diary');

const ExpressError = require('./utils/ExpressError');
const catchAsync = require('./utils/catchAsync');


const app = express();
const port = 3001;

app.use(cors({
    origin: 'http://localhost:3000', // 例: 'http://localhost:3000'
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));


mongoose.connect('mongodb://localhost:27017/diary'
)
    .then(() => console.log('コネクション接続成功'))
    .catch(err => {
        console.log('コネクション接続失敗');
        console.log(err);
    });

const sessionConfig = {
    secret: 'mysecret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: false,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
};
app.use(session(sessionConfig));

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());





//セッションがあるか確認する(React側からのリクエストを受け取る)

app.get('/api/check-session', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ authenticated: true, user: req.user });
    } else {
        res.json({ authenticated: false });
    }
});


//ユーザー登録機能(React側からのリクエストを受け取る)
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const newUser = new User({ username, email });
        const registeredUser = await User.register(newUser, password);
        req.login(registeredUser, err => {
            if (err) return res.status(500).json({ message: "ログインエラー" });
            res.status(200).json({ message: "登録成功", user: req.user });
        });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
}
);

//ユーザーログイン機能(React側からのリクエストを受け取る)
app.post('/api/login', passport.authenticate('local'), async (req, res) => {
    res.status(200).json({ message: "ログイン成功", user: req.user });
});



app.post('/api/logout', catchAsync(async (req, res) => {
    req.logout(function (err) {
        if (err) {
            return res.status(500).json({ message: "ログアウトエラー" });
        }
        // ログアウトが成功した後、セッションを削除
        req.session.destroy(function (err) {
            if (err) {
                return res.status(500).json({ message: "セッション削除エラー" });
            }
            // セッションを削除した後、クライアントに成功メッセージを送信
            // クライアントサイドでセッションCookieを削除するために、
            // 必要に応じてSet-Cookieヘッダーを使用してCookieをクリアする
            res.clearCookie('connect.sid');
            return res.status(200).json({ message: "ログアウト成功" });
        });
    });
}));

//Userに日記を追加する
app.post('/api/createDiary', catchAsync(async (req, res) => {

    const cloudinaryUpload = async (image) => {
        const result = await cloudinary.uploader.upload(image, {
            upload_preset: 'yeah-diary-ver2'
        });
        return result;
    }

    //DeepLで英訳する
    const translation = async (prompt) => {
        const translationResult = await translator.translateText(prompt, 'ja', 'en-US');
        const resultTransrate = translationResult.text;
        return resultTransrate;
    }
    //OpenAIのDALL-3で画像を生成する
    const generateImageURL = async (prompt) => {
        const response = await openai.images.generate({ model: "dall-e-3", prompt, n: 1, size: "1792x1024" });
        const generatedImageURL = response.data[0].url;
        return generatedImageURL;
    }
    //idからisAuthenticatedで認証されているか確認する
    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "認証されていません" });
    }
    if (!req.body) throw new ExpressError('無効な日記です', 400);
    const diary = new Diary({
        title: req.body.title,
        content: req.body.content,
        date: new Date().toLocaleString({ timeZone: 'Asia/Tokyo' }),
    });
    //diary.authorをreq.params.idに設定する
    diary.author = req.body.userId;
    //diary.contentを英訳する
    const promptTitle = diary.title;
    const promptContent = diary.content;
    const resultTransrateTitle = await translation(promptTitle);
    const resultTransrateContent = await translation(promptContent);
    diary.translate.title = resultTransrateTitle;
    diary.translate.content = resultTransrateContent;
    //DALL-3でdiaryImageを生成して、urlだけを取得する
    const DallEPrompt = `Illustrate '${diary.translate.title}' with 
    elements from '${diary.translate.content}'. Emphasize mood, key actions,
     and symbols using appropriate colors and light. `
        ;

    const aiImageURL = await generateImageURL(DallEPrompt);
    //cloudinaryにアップロードする
    const cloudinaryResult = await cloudinaryUpload(aiImageURL);
    diary.image.cloudinaryURL = cloudinaryResult.secure_url;
    //diary.image._idをuuidで生成する
    diary.image._id = uuidv4();
    if (diary.translate === undefined) {
        throw new ExpressError('英訳に失敗しました', 400);
    }
    if (diary.image.cloudinaryURL === undefined) {
        throw new ExpressError('画像生成またはアップロードに失敗しました', 400);
    }
    await diary.save();
    res.status(200).json({ message: "日記を追加しました", diary: diary });

}));
//日記をすべて取得する
app.get('/api/getDiary', catchAsync(async (req, res) => {

    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "認証されていません" });
    }
    const userId = req.query.userId;
    const diaries = await Diary.find({ author: userId });
    res.status(200).json({ message: "日記を取得しました", diaries: diaries });

}));

//日記個別を取得する
app.get('/api/getDiary/:id', catchAsync(async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "認証されていません" });
    }
    const diary = await Diary.findById(req.params.id);
    if (!diary) {
        return res.status(404).json({ message: "指定されたIDの日記が見つかりません" });
    }
    res.status(200).json({ message: "日記を取得しました", diary: diary });

}));

//日記を削除する
app.delete('/api/deleteDiary/:id', catchAsync(async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "認証されていません" });
    }
    const { id } = req.params;
    const diary = await Diary.findById(id);
    if (!diary) {
        return res.status(404).json({ message: "指定されたIDの日記が見つかりません" });
    }
    const cloudinaryDelete = async (imageId) => {
        const result = await cloudinary.uploader.destroy(imageId);
        return result;
    }
    try {
        const cloudinaryId = diary.image._id;
        await cloudinaryDelete(cloudinaryId);
        await Diary.findByIdAndDelete(id);
        res.status(200).json({ message: "日記を削除しました" });
    } catch (e) {
        return res.status(404).json({ message: "エラーが発生しました" });
    }
}));




app.listen(port, () => {
    console.log(`${port}番でサーバー起動中`);
});

