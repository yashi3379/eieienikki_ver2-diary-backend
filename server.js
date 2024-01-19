const express = require('express');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const cors = require('cors');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());
app.use(session({ secret: 'mysecret' }, { resave: true }, { saveUninitialized: true }));
//req.session.user = {};をしたい
const makeUserSession = app.use((req, res, next) => {
    if (!req.session.user) {
        req.session.user = {};
    }
    next();
}
);



mongoose.connect('mongodb://localhost:27017/diary'
)
    .then(() => console.log('コネクション接続成功'))
    .catch(err => {
        console.log('コネクション接続失敗');
        console.log(err);
    });



const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        minlength: 5,
        maxlength: 255
    },
    email: {
        type: String,
        required: true,
        minlength: 5,
        maxlength: 255
    },
    password: {
        type: String,
        require: true,
        minlength: 5,
        maxlength: 255
    },
    date: { type: Date, default: Date.now },
    diary: [{
        type: Schema.Types.ObjectId,
        ref: 'Diary'
    }]
});


const diarySchema = new Schema({
    content: {
        type: String,
        required: true,
        minlength: 10,
        maxlength: 255
    },
    date: { type: Date, default: Date.now },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
});

const User = mongoose.model('User', userSchema);
const Diary = mongoose.model('Diary', diarySchema);

//セッションがあるか確認する(React側からのリクエストを受け取る)

app.get('/api/check-session', (req, res) => {
    makeUserSession;
    if (req.session && req.session.user._id) {
        // セッションが存在する場合
        //_idから情報を全て取得する
        const user = User.findById(req.session.user._id);
        console.log(user);
        res.status(200).json({ loggedIn: true, username: user.username, email: user.email });
    } else {
        // セッションが存在しない場合
        res.status(200).json({ loggedIn: false });
    }
});


//ユーザー登録機能(React側からのリクエストを受け取る)
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    makeUserSession;
    try {
        const newUser = new User({ username, email, password });
        const salt = await bcrypt.genSalt(10);
        newUser.password = await bcrypt.hash(password, salt);
        await newUser.save();
        //sessionにuserのidを保存する
        req.session.user._id = newUser._id;
        //nameとemailとlogedInを返す
        res.status(200).json({ username: newUser.username, email: newUser.email });
    } catch (error) {
        console.error(error);
        res.status(500).send('エラーが発生しました');
    }
}
);

//ユーザーログイン機能(React側からのリクエストを受け取る)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    makeUserSession;
    if (!email || !password) return res.status(400).send('必須項目が入力されていません');
    try {
        //emailが一致するユーザーを検索
        const loginUser = await User.findOne({ email });
        //messageとログイン失敗を返す
        if (!loginUser) return res.status(400).json({ message: 'メールアドレスかパスワードが間違っています', loggedIn: false });
        //passwordが一致するか確認
        const validPassword = await bcrypt.compare(password, loginUser.password);
        //messageとログイン失敗を返す
        if (!validPassword) return res.status(400).json({ message: 'メールアドレスかパスワードが間違っています', loggedIn: false });
        res.session.user._id = loginUser._id;
        //nameとemailとlogedInを返す
        res.status(200).json({ username: loginUser.username, email: loginUser.email });
    } catch (err) {
        console.error(err);
        res.status(500).send('エラーが発生しました');
    }
});

//ログアウト機能(React側からのリクエストを受け取る)
app.post('/api/logout', async (req, res) => {
    makeUserSession;
    try {
        req.session.destroy();
        res.status(200).send('ログアウトしました');
    } catch (err) {
        console.error(err);
        res.status(500).send('エラーが発生しました');
    }
});
//Userに日記を追加する
app.post('/api/diary', async (req, res) => {
    makeUserSession;
    if (!req.session.user._id) return res.status(401).send('ログインしてください');
    const { content } = req.body;
    if (content.length < 5) return res.status(400).send('5文字以上入力してください');
    try {
        const newDiary = new Diary({ content });
        await newDiary.save();
        res.status(200).send(newDiary);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }

});
//日記をすべて取得する
app.get('/api/diary', async (req, res) => {
    makeUserSession;
    if (!req.session.user._id) return res.status(401).send('ログインしてください');
    try {
        const diaryEntries = await Diary.find().sort({ date: 'desc' });
        res.status(200).json(diaryEntries);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});




app.listen(port, () => {
    console.log(`${port}番でサーバー起動中`);
});
