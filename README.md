[![build status](https://secure.travis-ci.org/sfu/node-cas-sfu.png)](http://travis-ci.org/sfu/node-cas-sfu)
# node-cas-sfu
node-cas-sfu is a [CAS](http://www.jasig.org/cas) client for [Node.js](http://nodejs.org), tailored to work with [Simon Fraser University's](http://www.sfu.ca/itservices/publishing/publish_howto/enhanced_web_publishing/cas.html) CAS implementation.

# Features
node-cas-sfu supports CAS version 2 and *should* work with a vanilla CAS installation, though this has not been tested. It also supports SFU-specific extensions to CAS, such as:

* the allow string
* using non-SFU "Apache" accounts

# Usage
    var CAS = require('cas-sfu');
    var cas = new CAS({
        service: 'http://www.sfu.ca/myapp',     // REQUIRED; CAS will redirect back to this URL after a successful authentication
        allow: '!basket-weaving',                        // OPTIONAL; comma-delimited string. Defaults to "sfu". See http://i.sfu.ca/MWkAlX for a full list of allow options
        userObject: 'AUTH_USER'                 // OPTIONAL; object where the CAS response will be stored. Defaults to 'authenticatedUser'
    });

    // validate a ticket:
    cas.validate(ticket, function(err, loggedIn, casResponse) {
        if (loggedIn) {
            console.log("Hello, you are logged in as %s", casResponse.user);
        } else {
            console.log("You are not logged in.");
        }
    });

Several options are provided as defaults in the module but these can be overridden (e.g. to authenticate against cas-test.sfu.ca instead of cas.sfu.ca):

    defaults = {
            casHost: 'https://cas.sfu.ca',
            casBasePath: '/cgi-bin/WebObjects/cas.woa',
            loginPath: '/wa/login',
            logoutPath: '/wa/logout',
            validatePath: '/wa/servicevalidate',
            appLogoutPath: '/wa/applogout'
    };

You can override any of these by providing your own values in the options object you pass to new CAS() or CAS#getMiddleware()

Once a user has logged in, you will have an object containing information about the user (essentially, a JSON representation of the XML document returned by CAS). This object will be in either `req.authenticatedUser` or `req.session.authenticatedUser` (where `authenticatedUser` is whatever name you provided to the `userObject` option when you initialized the CAS client; `authenticatedUser` is the default). For example, if you initialized CAS with `allow: '!list-1,!list-2'` and log in as user kipling, who is a member of "list-2", the `authenticatedUser` object will be:

    {
        user: 'kipling',
        authtype: 'sfu',
        maillist: 'list-2',
        logindate: Thu, 19 Apr 2012 01:06:59 GMT    // a date object
    }

## Usage in Connect/Express
node-cas-sfu exposes a getMiddleware function to provide Express middleware:

    var cas = require('cas-sfu');
    var casauth = cas.getMiddleware({
        service: 'http://www.sfu.ca/myapp',
        allow: '!basket-weaving',
        userObject: 'AUTH_USER'
    });

    var loggedin = function(req, res, next) {
        if ((req.session && req.session.AUTH_USER) || req.AUTH_USER) {
            next();
            return;
        }
        req.session.referer = req.url;  // store the referrer so we can send them back there after logging in
        res.redirect('/login');
    };

    app.get('/secretstuff', loggedin, function(req, res) {
        res.send('Hello, ' + req.session.AUTH_USER.user);       // Hello, kipling
    });

    app.get('/login', casauth, function(req, res) {
        req.session.AUTH_USER.logindate = new Date();
        console.log(req.session.AUTH_USER);
        res.redirect(req.session.referer || '/');
    });

You may find it useful to have the logged-in user's username appear in your Express log, similar to how AUTH_USER or REMOTE_USER appears in the default Apache common log. You can do this by defining a custom Express log token and a custom log format:

    app.configure(function() {
        express.logger.token('user', function(req, res) {
            var user = '-';
            if (req.session && req.session.AUTH_USER) {
                user = req.session.AUTH_USER.user;
            }
            return user;
        });
        app.use(express.logger({format: ':remote-addr - :user [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'}));
    });

No user logged in:

    127.0.0.1 - - [Thu, 19 Apr 2012 01:06:45 GMT] "GET /protected HTTP/1.1" 302 - "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_3) AppleWebKit/536.6 (KHTML, like Gecko) Chrome/20.0.1096.1 Safari/536.6"

User logged in:

    127.0.0.1 - kipling [Thu, 19 Apr 2012 01:06:59 GMT] "GET /favicon.ico HTTP/1.1" 404 - "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_3) AppleWebKit/536.6 (KHTML, like Gecko) Chrome/20.0.1096.1 Safari/536.6"

## Using non-SFU (aka Apache) accounts
SFU's implementation of CAS allows users to authenticate with made-up, non-SFU accounts. These are often referred to as "Apache accounts" as they are most commonly used in Apache .htpasswd files via the [mod_auth_cas](http://www.sfu.ca/itservices/publishing/publish_howto/enhanced_web_publishing/cas/apache_module.html) Apache module. node-cas-sfu also supports Apache accounts; you can use them by setting `allow=apache` and including an `apacheUsers` object containing username & password hash pairs:

    var CAS = require('cas-sfu');
    var cas = new CAS({
        service: 'http://www.sfu.ca/myapp',
        allow: 'apache',
        userObject: 'AUTH_USER',
        apacheUsers: {"myfakeuser": "ubjQPM.hh9Qj2"}
    });

Passwords can be any of UNIX crypt, SHA1, Apache MD5 or even plain text (but really, don't do plain text). node-cas-sfu uses the [pass](https://github.com/andris9/pass) module to validate hashes.

# Tests
Run `node test.js` or `npm test` to run the tests. The test script will prompt you for a valid SFU username & password (not recorded or stored anywhere) and will use those credentials to log into CAS via the REST interface, obtain a Service Ticket and attempt to validate that ticket. It will also attempt the same using a made-up "Apache" account (myfakeuser:pencil69).

# License

Copyright (C) 2012 Simon Fraser University

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


