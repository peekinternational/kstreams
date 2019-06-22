/*
* author  => Peek International
* designBy => Peek International
*/
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
	"userId":Number,
	"name":String,
	"email":String,
	"user_image":String,
	"phone":Number,
	"country":String,
	"password":String,
	"chat":[{senderId:String,recevierId:String,date:{type:Date,default:Date.now},message:String,unreadMsg:{type:Number,default:0},isseen:{type:Boolean,default:false}}],
	"status":{ type: String, default:0 },  //offline=1/online=0
	"pStatus":{ type: Number, default:0 },  //active=0/away=1/dNotDisturb=2/Invisible=3
	"date": { type: Date, default: Date.now },
	"updatedAt": {type: Date, default: Date.now}
});

userSchema.pre('save', function (next){
  this.updatedAt = Date.now();
  next();
});
userSchema.pre('update', function() {
  this.update({},{ $set: { updatedAt: new Date() } });
});

module.exports = mongoose.model('Users',userSchema);