var request = require('request')
,   url = require('url')
,   parser = require('xml2json');

var extend = function(target, source) {
    for (var i in source) {
        target[i] = source[i];
    }
};

var cleanCasResponse = function(str) {
	// strip off 'cas:' namespaces from XML documents
	return str.replace(/cas:/g, '');
};

var parseUserFile = function(file) {
    /* assumes a file in pattern
        username:ENCRYPTEDPASSWORD
    */
    var users = {};
    
    try {
        var f = require('fs').readFileSync(file, 'utf-8');
    } catch (err) {
        throw ('Error reading supplied apache_user file: ' + err.message);
    }
    
    f = f.split('\n');
    f.forEach(function(line, i, arr) {
        if (line) {
            var parts = line.split(':')
            ,   username, passhash;
            if (parts.length === 2) {
                users[parts[0]] = parts[1];
            }
        }
    });
    return users;
};

var CAS = module.exports = function CAS(options) {
    
    if (!options.cas_base) { throw ('Required CAS option "cas_base" not provided'); }
    if (!options.service) { throw ('Required CAS option "service" not provided'); }
	if (options.proxy && !options.proxy.pgturl) { throw ('CAS option "pgturl" not provided and is required for proxy ticket support'); }	
	if (options.proxy && options.proxy.pgturl && url.parse(options.proxy.pgturl).proto !== 'https:') { throw ('CAS option "pgturl" must be a HTTPS URL'); }
    if (options.allow && options.allow.indexOf('apache') >= 0 && !options.apache_users) { throw ('allow=apache specified but option "apache_users" not provided.'); }

    var paths = {
        login: '/login',
        logout: '/logout',
        applogout: '/applogout',
        servicevalidate: '/servicevalidate',
        proxyvalidate: 'wa/proxyvalidate'
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
				if (options.proxy && options.proxy.pgturl) { u.query.pgturl = options.pgturl; }
				if (options.servicevalidate) { extend(u.query, options.servicevalidate); }
				if (options.allow) { u.query.allow = options.allow; }
            break;
            
            case 'proxyvalidate':
            break;

            default:
                throw ('Can not create URL for path ' + path);
            break;
        };
        return url.format(u);
    };
    
    
    this.service = service;
    this.options = options;
    this.urls = {};
    for (var path in paths) {
        this.urls[path] = makeUrl(path);
    }

};

CAS.prototype.validate = function(ticket, callback) {
    var svurl = url.parse(this.urls.servicevalidate);
    svurl.query += '&ticket=' + ticket;
    request.post({uri: svurl, body: svurl.query}, function(err, response, body) {
       if (err) {
           callback(error);
           return false;
       }
       var cas_response = parser.toJson(body, {object:true});
       var logged_in = cas_response['cas:serviceResponse'].hasOwnProperty('cas:authenticationSuccess') ? true : false;
       callback(null, logged_in, cas_response);
    });
};

CAS.prototype.getProxyTicket = function(pgt, targetService, callback) {
	
	// rough
	request({
		uri: 'https://cas.sfu.ca/cgi-bin/WebObjects/cas.woa/wa/proxy?pgt=' + pgt + '&targetservice=' + targetService
	}, function(err, response, body) {
		var proxy_resp = parser.toJson(body, {object:true});
		callback(proxy_resp);
	});
	
};