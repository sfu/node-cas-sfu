var request = require('request')
,   url = require('url')
,   parser = require('xml2json');

var extend = function(target, source) {
    for (var i in source) {
        target[i] = source[i];
    }
};

var CAS = module.exports = function CAS(service, options) {
    
    if (arguments.length === 0 || typeof service !== 'string') {
        throw ('Required CAS option "service" not provided');
    }
    var options = options || {};
    var cas_base = 'https://cas.sfu.ca/cgi-bin/WebObjects/cas.woa'
    , paths = {
        login: '/wa/login',
        logout: '/wa/logout',
        applogout: '/wa/applogout',
        servicevalidate: '/wa/servicevalidate'
    };
    
    if (!options.hasOwnProperty('allow')) {
        options.allow = 'sfu';
    }
    
    var makeUrl = function(path) {
        var u;
        switch (path) {
            case 'login':
                // need service, all other options
                u = url.parse(cas_base + paths.login);
                u.query = {
                    service: service
                };
                extend(u.query, options);
            break;
            
            case 'logout':
                u = url.parse(cas_base + paths.logout);
            break;
            
            case 'applogout':
                u = url.parse(cas_base + paths.applogout);
            break;
            
            case 'servicevalidate':
                u = url.parse(cas_base + paths.servicevalidate);
                u.query = {
                    service: service,
                    allow: options.allow
                };
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
    console.log(ticket);
    svurl.query += '&ticket=' + ticket;
    console.log(svurl);
    request.post({uri: svurl, body: svurl.query}, function(err, response, body) {
       if (err) {
           callback(error);
           return false;
       }
       // console.log(arguments);
       
       var cas_response = parser.toJson(body, {object:true});
       var logged_in = cas_response['cas:serviceResponse'].hasOwnProperty('cas:authenticationSuccess') ? true : false;
       callback(null, logged_in, cas_response);
    });
};
