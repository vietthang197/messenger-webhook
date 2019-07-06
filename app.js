var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var favicon = require('serve-favicon');
var path = require('path');
var session = require('express-session');
var passport = require('passport');
var passportFb = require('passport-facebook').Strategy;

// controller
var indexRouter = require('./routes/index');
var webhookRouter = require('./routes/webhook');
var licenseRouter = require('./routes/license');
var guideRouter = require('./routes/guide');
var fbLoginRouter = require('./routes/facebook_login');
var imageViewRouter = require('./routes/content_view');

const bodyParser = require('body-parser');

var app = express().use(bodyParser.json());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: 'keyboard cat',
  key: 'sid',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// passport facebook login
app.use(passport.initialize());
app.use(passport.session());

app.use(favicon(path.join(__dirname, 'public/images', 'favicon.png')));

// routes controller

app.use('/', indexRouter);
app.use('/webhook', webhookRouter);
app.use('/license', licenseRouter);
app.use('/guide', guideRouter);
app.use('/fb-login', passport.authenticate('facebook', {scope: ['email']}));

app.use('/fb-login/callback', passport.authenticate('facebook', {
  failureRedirect: '/', successRedirect: '/'
}), function (req, res) {
  res.redirect('/');
});

app.use('/content-view', imageViewRouter);

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/')
}


// setup passport to login facebook sdk

passport.use(new passportFb({
  clientID: "522160304988169",
  clientSecret: "117f440d1783f5ef2387fc1541b8999e",
  callbackURL: "https://infinite-peak-51661.herokuapp.com/fb-login/callback",
  profileFields: ['email', 'displayName', 'gender', 'locale']
}, (accessToken, refreshToken, profile, done) => {
  console.log('>>>>>>>>>>>> this profile');
  console.log(profile);
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
   done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
