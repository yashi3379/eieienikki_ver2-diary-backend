const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');
const UserSchema = new Schema({
email: {
    type: String,
    required: true,
    unique: true
}
});

UserSchema.plugin(passportLocalMongoose,{
    errorMessages:{
        IncorrectPasswordError: 'パスワードが間違っています。',
        IncorrectUsernameError: 'ユーザー名が間違っています。',
        MissingPasswordError: 'パスワードがありません。',
        MissingUsernameError: 'ユーザー名がありません。',
        UserExistsError: 'ユーザーが既に存在しています。',
        TooManyAttemptsError: 'アカウントがロックされました。しばらくしてから再度お試しください。',
        NoSaltValueStoredError: '認証に失敗しました。しばらくしてから再度お試しください。',
        AttemptTooSoonError: 'アカウントがロックされました。しばらくしてから再度お試しください。',
    }
});


module.exports = mongoose.model('User', UserSchema);