const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const DiarySchema = new Schema({
    content: {
        type: String,
        required: true
    },
    date: {
        type: String,
    },
    translate:{
        type: String,
    },
    image:{
        _id: String,
        cloudinaryURL: String
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
});

module.exports = mongoose.model('Diary', DiarySchema);