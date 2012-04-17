var request = require('request')
,	url = require('url')
,   parser = require('xml2json')
,	utils = require('./utils')
,	__ = require('underscore')
,	defaults = {
		casHost: 'https://cas.sfu.ca',
		casBasePath: '/cgi-bin/WebObjects/cas.woa',
		loginPath: '/wa/login',
		logoutPath: '/wa/logout',
		validatePath: '/wa/servicevalidate',
		appLogoutPath: '/wa/applogout'
};

var CAS = function(options) {
    if (!options.cas_base) { throw ('Required CAS option "cas_base" not provided'); }
	if (!options.server_base_url) { throw ('Required CAS option "server_base_url" not provided'); }
    if (options.allow && options.allow.indexOf('apache') >= 0 && !options.apache_users) { throw ('allow=apache specified but option "apache_users" not provided.'); }
    if (!options.user_object) { options.user_object = 'authenticatedUser'; }
    this.options = options;
};

CAS.prototype.validate = function(req, ticket, callback) {
	var server_base_url = typeof this.options.server_base_url === 'function' ? this.options.server_base_url(req) : this.options.server_base_url;
	
	
    // construct service url from server base and current URL
    var service = url.parse(server_base_url + req.url, true);
	delete service.query.ticket;
	delete service.search;
	service = url.format(service);
	
	var bodystr = 'ticket=' + ticket + '&service=' + service;
	if (this.options.allow) {
		bodystr += '&allow=' + this.options.allow;
	}
	
    // call /validate with the ticket & service and call the callback
	request.post({
		uri: this.options.cas_base + '/servicevalidate',
		body: bodystr
	}, function(err, response, body) {
		if (err) {
			// do something
			callback(err, null, null);
			return;
		}
		var cas_response = parser.toJson(utils.cleanCasResponse(body), {object:true});
		var logged_in = cas_response.serviceResponse.authenticationSuccess ? true : false;
		cas_response = logged_in ? cas_response.serviceResponse.authenticationSuccess : cas_response.serviceResponse.authenticationFailure;
		callback(null, logged_in, cas_response);
	});
};

exports.getMiddleware = function(options) {
	var cas = new CAS(options);
	return function(req, res, next) {
		
		var ticket, redirect_url, service
		,	server_base_url = typeof options.server_base_url === 'function' ? options.server_base_url(req) : options.server_base_url;
		
		// need to deal with an already-logged-in user here -- should just call next and return
		if (req[options.user_object] || (req.session && req.session[options.user_object])) {
			next();
			return;
		}

		ticket = req.param('ticket');
		if (ticket) {
			// we have a ticket param; validate it
			cas.validate(req, ticket, function(err, logged_in, cas_response) {
				if (req.session) {
					req.session[options.user_object] = cas_response;
				} else {
					req[options.user_object] = cas_response;
				}
				next();
				return;
			});
		} else {
			// no ticket, redirect to cas login
			redirect_url = url.parse(options.cas_base + '/login', true);
			service = server_base_url + req.url;
			console.log('SERVICE: ' + service);
			redirect_url.query.service = service;
			if (options.allow) {
				redirect_url.query.allow = options.allow;
			}
			res.redirect(url.format(redirect_url));
		}
		
	};
};