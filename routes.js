const express = require("express");
const routes= express.Router();
const mongoose= require('mongoose');
const bodyparser = require('body-parser');
const e = require("express");
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
routes.use(express.static(__dirname + ''));
const multer = require('multer');
const fs= require('fs');

PDFParser = require('pdf2json');
var storage=multer.diskStorage({
    destination:function(req,file,callback){
        var dir = "./uploads";

        if(!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        callback(null,dir);
    },
    filename:function(req,file,callback){
        callback(null,file.originalname);
    }
});
var upload=multer({storage:storage}).array("files",12);


routes.use(bodyparser.urlencoded({extended:true}));
const user = require('./models.js');
routes.use(cookieParser('secret'));
routes.use(session({
    secret:'secret',
    maxAge:3600000,
    resave:true,
    saveUninitialized:true,
}));


const passport = require("passport");
const mongoURI="mongodb+srv://naman2299:naman2299@devconnector.p9rpl.mongodb.net/upload01?retryWrites=true&w=majority";
mongoose.connect(mongoURI,{
    useNewUrlParser: true, useUnifiedTopology: true
}).then(()=>console.log("DATA Connected"));

routes.use(passport.initialize());
routes.use(passport.session());

routes.use(flash());




routes.use(function (req, res, next) {
    res.locals.success_message = req.flash('success_message');
    res.locals.error_message = req.flash('error_message');
    res.locals.error = req.flash('error');
    next();
});

const checkAuthenticated = function(req,res,next){
    if(req.isAuthenticated())
    {
        res.set('Cache-Control','no-cache,private,no-store, must-revalidate,post-check=0,pre-check=0');
        return next();
    }
    else{
        res.redirect('/login');
    }
};


routes.get('/',(req,res)=>{
    res.render('index');
});

routes.post('/register',(req,res)=>{
    var{email,username,password,confirmpassword}=req.body;
    var err;
    if(!email || !username || !password || !confirmpassword)
    {
        err="Please Fill All Fields";
        res.render('index',{'err':err});
    }
    if(password != confirmpassword)
    {
        err="Passwords Don't Match";
        res.render('index',{'err':err , 'username':username, 'email':email});
    }
    if(typeof err == 'undefined')
    {
        user.findOne({email:email},function(err,data){
            if(err) throw err;
            if (data){
                console.log("USER ALREADY EXISTS");
                err="User Already Exists with this EMAIL";
                res.render('index',{'err':err , 'username':username, 'email':email});
            }
            else{
                bcrypt.genSalt(10,(err,salt)=>{
                    if(err) throw err;
                    bcrypt.hash(password,salt,(err,hash)=>{
                        if(err) throw err;
                        password=hash;
                        user({
                            email,
                            username,
                            password
                        }).save((err,data)=>{
                            if(err) throw err;
                            req.flash("success_message","Registered Successfully :: LogIn to Continue");
                            res.redirect('/login');
                        });
                    });
                });
            }
        });
    }
});

var localStrategy = require("passport-local").Strategy;
passport.use(new localStrategy({usernameField:'email'},(email,password,done)=>{
    user.findOne({email:email},(err,data)=>{
        if(err) throw err;
        if(!data){
            return done(null,false,{message:"Account With This Mail Doesn't Exists"});
        }
        bcrypt.compare(password,data.password,(err,match)=>{
            if(err) throw err;
            if(!match)
            {
                return done(null,false,{message:"Password Incorrect"});
            }
            if(match)
            {
                return done(null,data);
            }
        });
    });
}));

passport.serializeUser(function(user,cb){
    cb(null,user.id);
});
passport.deserializeUser(function(id,cb){
    user.findById(id,function(err,user){
        cb(err,user);
    });
});


routes.get('/login',(req,res)=>{
    res.render('login');
});

routes.post('/login',(req,res,next)=>{
    passport.authenticate('local',{
        failureRedirect:'/login',
        successRedirect:'/success',
        failureFlash:true,        
    })(req,res,next);
});

routes.get('/success',checkAuthenticated,(req,res)=>{
    res.render('success',{'user':req.user});
});

routes.get('/logout',(req,res)=>{
    req.logout();
    res.redirect('/login');
});

routes.post('/upload',checkAuthenticated,(req,res,next)=>{
    // user.findOneAndUpdate(
    //     {email:req.user.email},
    //     {$push:{
    //         messages:req.body['msg']
    //     }},(err,suc)=>{
    //         if(err) throw err;
    //         if(suc) console.log("Added Successfully");
    //     }
    // );
    // res.redirect('/success');
    upload(req,res,function(err){
        if(err){
            return res.send(err);
        }
    
        res.send("upload complete");
        });
})
var textSt="";
routes.get('/convert',async (req,res,next)=>{
    var pdfName=req.query.pdfName;
    console.log(pdfName);

    let pdfParser = new PDFParser();
 
    pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
    pdfParser.on("pdfParser_dataReady", pdfData => {
        fs.writeFileSync("./uploads/text.json", JSON.stringify(pdfData));
    });
    
    await fs.readFile("./uploads/text.json", function(err, data) { 
      
        // Check for errors 
        if (err) throw err; 
       
        // Converting to JSON 
        const users = JSON.parse(data); 
          var pages = users.formImage.Pages;
        console.log(users); // Print users  
        console.log(pages[0].Texts[1].R[0].T);

        pages.forEach(page=>{
            page.Texts.forEach(text=>{
                textSt=textSt+text.R[0].T+" ";
            });
        });
        user.findOneAndUpdate(
                {email:req.user.email},
                {$push:{
                    messages:textSt
                }},(err,suc)=>{
                    if(err) throw err;
                    if(suc) console.log("Added Successfully");
                }
            );
            res.redirect('/success');
        // res.send(textSt);
    });
    var pdfPath="./uploads/"+pdfName;
    pdfParser.loadPDF(pdfPath);

})
module.exports = routes;