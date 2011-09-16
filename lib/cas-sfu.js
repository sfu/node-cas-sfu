var request = require('request')
,   url = require('url')
,   parser = require('xml2json')
,	utils = require('./utils');

var CAS = module.exports = function CAS(options) {
    
    if (!options.cas_base) { throw ('Required CAS option "cas_base" not provided'); }
    if (!options.service) { throw ('Required CAS option "service" not provided'); }
    if (options.allow && options.allow.indexOf('apache') >= 0 && !options.apache_users) { throw ('allow=apache specified but option "apache_users" not provided.'); }

    var paths = {
        login: '/login',
        logout: '/logout',
        applogout: '/applogout',
        servicevalidate: '/servicevalidate'
    };
        
    var makeUrl = function(path) {
        var u = url.parse(options.cas_base + paths[path]);
        u.query = {};
        
        switch (path) {
            case 'login':
                u.query.service = options.service;
                if (options.login) { extend(u.query, options.login); }
                if (options.allow) { u.query.allow = options.allow; }
            break;
            
            case 'logout':
				u = u;
				if (options.logout) { u.query = options.logout; }
            break;
            
            case 'applogout':
				u = u;
				if (options.logout) { u.query = options.logout; }
            break;
            
            case 'servicevalidate':
                u.query.service = options.service;
				if (options.servicevalidate) { extend(u.query, options.servicevalidate); }
				if (options.allow) { u.query.allow = options.allow; }
            break;
            
            default:
                throw ('Can not create URL for path ' + path);
            break;
        };
        return url.format(u);
    };
        
    this.urls = {};
    for (var path in paths) {
        this.urls[path] = makeUrl(path);
    }
    
    if (options.apache_users) {
        if (typeof options.apache_users === 'string') {
            // assume this is a file, parse it; throw if no such file
            this.apache_users = parseUserFile(options.apache_users);
        } else if (typeof options.apache_users === 'object') {
            this.apache_users = options.apache_users;
        }
    }
};

CAS.prototype.validate = function(ticket, callback) {
    if (!ticket) {
        callback('No ticket provided', null, null);
        return false;
    }
    var that = this;
    var servicevalidate_url = url.parse(this.urls.servicevalidate);
    servicevalidate_url.query += '&ticket=' + ticket;
    request.post({uri: servicevalidate_url, body: servicevalidate_url.query}, function(err, response, body) {
		if (err) {
			callback(err, null, null);
			return false;
		}

		var cas_response = parser.toJson(cleanCasResponse(body), {object:true});
		var logged_in = cas_response.serviceResponse.authenticationSuccess ? true : false;
		cas_response = logged_in ? cas_response.serviceResponse.authenticationSuccess : cas_response.serviceResponse.authenticationFailure;
		
		if (logged_in && cas_response.authtype === 'apache') {
		    that.authenticateApacheUser(cas_response, callback);
		} else {
		    callback(null, logged_in, cas_response);
		}		
	});
};

CAS.prototype.authenticateApacheUser = function(cas_response, callback) {
    if (!cas_response.authtype === 'apache' || !cas_response.password) { return false; }
    var pass = require('pass');
    var username = cas_response.user
    ,   password = cas_response.password
    ,   hash = this.apache_users[username];
    if (!hash) {
        callback(null, false, cas_response);
        return;
    }
    pass.validate(cas_response.password, this.apache_users[cas_response.user], function(error, success) {
        if (error) {
            console.log('Error occurred validating apache user: ' + error);
            return false;
        }
        delete cas_response.password;
        callback(null, success, cas_response);
    });
};