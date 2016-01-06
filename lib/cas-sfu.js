var request = require('request')
,	url = require('url')
,   parser = require('xml2json')
,	utils = require('./utils')
,	__ = require('underscore')
,	defaults = {
		casHost: 'https://cas.sfu.ca',
		casBasePath: '/cas',
		loginPath: '/login',
		logoutPath: '/logout',
		validatePath: '/serviceValidate',
		appLogoutPath: '/applogout'
};

var CAS = module.exports = function(options) {
	__.defaults((options || {}), defaults);
	if (!options.service) { throw ('Required CAS option "service" not provided'); }
    if (options.allow && options.allow.indexOf('apache') >= 0 && !options.apacheUsers) { throw ('allow=apache specified but option "apacheUsers" not provided.'); }
    if (!options.userObject) { options.userObject = 'authenticatedUser'; }
    options.casBase = options.casHost + options.casBasePath;
    this.options = options;
    exports.options = options;
};

CAS.prototype.validate = function(ticket, callback) {
	var service = url.parse(this.options.service, true)
    ,	bodystr;
	delete service.query.ticket;
	delete service.search;
	service = url.format(service);

	bodystr = '?ticket=' + ticket + '&service=' + service;
	if (this.options.allow) {
		bodystr += '&allow=' + this.options.allow;
	}

    // call /validate with the ticket & service and call the callback
	request.get({
		uri: this.options.casBase + this.options.validatePath + bodystr
	}, function(err, response, body) {
		if (err) {
			// do something
			callback(err, null, null);
			return;
		}
		var casResponse = parser.toJson(utils.cleanCasResponse(body), {object:true});
		var loggedIn = casResponse.serviceResponse.authenticationSuccess ? true : false;
		casResponse = loggedIn ? casResponse.serviceResponse.authenticationSuccess : casResponse.serviceResponse.authenticationFailure;
		callback(null, loggedIn, casResponse);
	});
};

CAS.prototype.authenticateApacheUser = function(casResponse, callback) {
	if (casResponse.authtype !== 'apache' || !casResponse.password) { return false; }
	var pass = require('pass')
	,	username = casResponse.user
	,	password = casResponse.password
	,	hash = this.options.apacheUsers[username];

	if (!hash) {
		callback(null, false, casResponse);
		return;
	}

	pass.validate(casResponse.password, this.options.apacheUsers[username], function(error, success) {
		if (error) {
			callback(error, false, null);
			return;
		}
		delete casResponse.password;
		callback(null, success, casResponse);
	});
};

module.exports.getMiddleware = function(options) {
	var cas = new CAS(options);
	module.exports.options = options;
	return function(req, res, next) {
		var ticket, redirectUrl;

		// need to deal with an already-logged-in user here -- should just call next and return
		if (req[options.userObject] || (req.session && req.session[options.userObject])) {
			next();
			return;
		}

		ticket = req.param('ticket');
		if (ticket) {
			// we have a ticket param; validate it
			cas.validate(ticket, function(err, loggedIn, casResponse) {
				if (loggedIn) {
					if (casResponse.authtype === 'apache') {
						cas.authenticateApacheUser(casResponse, function(err, loggedIn, casResponse) {
							if (loggedIn) {
								if (req.session) {
									req.session[options.userObject] = casResponse;
								} else {
									req[options.userObject] = casResponse;
								}
								next();
								return;
							} else {
								// invalid apache password; redirect back to cas login page with error message
								redirectUrl = url.parse(options.casBase + options.loginPath, true);
								redirectUrl.query.renew = "true";
								redirectUrl.query.user = casResponse.user;
								redirectUrl.query.error = 'The credentials you provided cannot be determined to be authentic.';
								if (options.allow) {
									redirectUrl.query.allow = options.allow;
								}
								// need to remove the ticket param from the service URL to avoid multiple tickets
								var service = url.parse(options.service, true);
								delete service.query.ticket;
								delete service.search;
								redirectUrl.query.service = url.format(service);
								res.redirect(url.format(redirectUrl));
							}
						});
					} else {
						if (req.session) {
							req.session[options.userObject] = casResponse;
						} else {
							req[options.userObject] = casResponse;
						}
						next();
						return;
					}

				}
			});
		} else {
			// no ticket, redirect to cas login
			redirectUrl = url.parse(options.casBase + options.loginPath, true);
			redirectUrl.query.service = options.service;
			if (options.allow) {
				redirectUrl.query.allow = options.allow;
			}
			res.redirect(url.format(redirectUrl));
		}
	};
};
