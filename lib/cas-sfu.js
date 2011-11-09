var request = require('request')
,	url = require('url')
,   parser = require('xml2json')
,	utils = require('./utils');

var CAS = function(options) {
    if (!options.cas_base) { throw ('Required CAS option "cas_base" not provided'); }
	if (!options.server_base_url) { throw ('Required CAS option "server_base_url" not provided'); }
    if (options.allow && options.allow.indexOf('apache') >= 0 && !options.apache_users) { throw ('allow=apache specified but option "apache_users" not provided.'); }
    
    this.options = options;
};

CAS.prototype.validate = function(req, ticket, callback) {
    // construct service url from server base and current URL
    var service = url.parse(this.options.server_base_url + req.url, true);
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
		
		var ticket, redirect_url, service;
		
		// need to deal with an already-logged-in user here -- should just call next and return
		if (req.authenticatedUser || (req.session && req.session.authenticatedUser)) {
			next();
			return;
		}

		ticket = req.param('ticket');
		if (ticket) {
			// we have a ticket param; validate it
			cas.validate(req, ticket, function(err, logged_in, cas_response) {
				if (req.session) {
					req.session.authenticatedUser = cas_response;
				} else {
					req.authenticatedUser = cas_response;
				}
				next();
				return;
			});
		} else {
			// no ticket, redirect to cas login
			redirect_url = url.parse(options.cas_base + '/login', true);
			service = options.server_base_url + req.url;
			redirect_url.query.service = service;
			if (options.allow) {
				redirect_url.query.allow = options.allow;
			}
			res.redirect(url.format(redirect_url));
		}
		
	};
};


// 
// var CAS = module.exports = function CAS(options) {
//     
//     if (!options.cas_base) { throw ('Required CAS option "cas_base" not provided'); }
//     if (!options.service) { throw ('Required CAS option "service" not provided'); }
//     if (options.allow && options.allow.indexOf('apache') >= 0 && !options.apache_users) { throw ('allow=apache specified but option "apache_users" not provided.'); }
// 
//     var paths = {
//         login: '/login',
//         logout: '/logout',
//         applogout: '/applogout',
//         servicevalidate: '/servicevalidate'
//     };
//         
//     var makeUrl = function(path) {
//         var u = url.parse(options.cas_base + paths[path]);
//         u.query = {};
//         
//         switch (path) {
//             case 'login':
//                 u.query.service = options.service;
//                 if (options.login) { utils.extend(u.query, options.login); }
//                 if (options.allow) { u.query.allow = options.allow; }
//             break;
//             
//             case 'logout':
//              u = u;
//              if (options.logout) { u.query = options.logout; }
//             break;
//             
//             case 'applogout':
//              u = u;
//              if (options.logout) { u.query = options.logout; }
//             break;
//             
//             case 'servicevalidate':
//                 u.query.service = options.service;
//              if (options.servicevalidate) { utils.extend(u.query, options.servicevalidate); }
//              if (options.allow) { u.query.allow = options.allow; }
//             break;
//             
//             default:
//                 throw ('Can not create URL for path ' + path);
//             break;
//         };
//         return url.format(u);
//     };
//         
//     this.urls = {};
//     for (var path in paths) {
//         this.urls[path] = makeUrl(path);
//     }
//     
//     if (options.apache_users) {
//         if (typeof options.apache_users === 'string') {
//             // assume this is a file, parse it; throw if no such file
//             this.apache_users = utils.parseUserFile(options.apache_users);
//         } else if (typeof options.apache_users === 'object') {
//             this.apache_users = options.apache_users;
//         }
//     }
// };
// 
// CAS.prototype.validate = function(ticket, callback) {
//     if (!ticket) {
//         callback('No ticket provided', null, null);
//         return false;
//     }
//     var that = this;
//     var servicevalidate_url = url.parse(this.urls.servicevalidate);
//     servicevalidate_url.query += '&ticket=' + ticket;
//     request.post({uri: servicevalidate_url, body: servicevalidate_url.query}, function(err, response, body) {
//      if (err) {
//          callback(err, null, null);
//          return false;
//      }
// 
//      var cas_response = parser.toJson(utils.cleanCasResponse(body), {object:true});
//      var logged_in = cas_response.serviceResponse.authenticationSuccess ? true : false;
//      cas_response = logged_in ? cas_response.serviceResponse.authenticationSuccess : cas_response.serviceResponse.authenticationFailure;
//      
//      if (logged_in && cas_response.authtype === 'apache') {
//          that.authenticateApacheUser(cas_response, callback);
//      } else {
//          callback(null, logged_in, cas_response);
//      }       
//  });
// };
// 
// CAS.prototype.authenticateApacheUser = function(cas_response, callback) {
//     if (!cas_response.authtype === 'apache' || !cas_response.password) { return false; }
//     var pass = require('pass');
//     var username = cas_response.user
//     ,   password = cas_response.password
//     ,   hash = this.apache_users[username];
//     if (!hash) {
//         callback(null, false, cas_response);
//         return;
//     }
//     pass.validate(cas_response.password, this.apache_users[cas_response.user], function(error, success) {
//         if (error) {
//             console.log('Error occurred validating apache user: ' + error);
//             return false;
//         }
//         delete cas_response.password;
//         callback(null, success, cas_response);
//     });
// };