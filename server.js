const express = require('express');
const mongoose = require('mongoose');

const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const methodOverride = require('method-override');

const User = require('./models/user');
const Diary = require('./models/diary');


const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
//req.session.user = {};をしたい

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
        httpOnly: true,
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
app.post('/api/login', passport.authenticate('local'),async (req, res) => {
    res.status(200).json({ message: "ログイン成功", user: req.user });
});

//ログアウト機能(React側からのリクエストを受け取る)
app.post('/api/logout', async (req, res) => {
    req.logout();
    res.json({ message: "ログアウト成功" });
});
//Userに日記を追加する
app.post('/api/diary', async (req, res) => {
   
});
//日記をすべて取得する
app.get('/api/diary', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "認証されていません" });
    }

    const diaries = await Diary.find({ author: req.user._id });
    res.json({ diaries });
});




app.listen(port, () => {
    console.log(`${port}番でサーバー起動中`);
});

