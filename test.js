var request = require('request')
,   assert = require('assert')
,   prompt = require('prompt')
,   url = require('url')
,   CAS = require('./index')
,   cas = new CAS({
        service: 'casmoduletest',
        allow: 'sfu,apache',
        apacheUsers: {
            myfakeuser: 'D4GoqtnYVr2fI' // pencil69
        }
    })
,   prompts = [
        {
            name: 'username',
            message: 'Valid SFU Username',
            empty: false
        },
        {
            name: 'password',
            message: 'Valid password',
            hidden: true,
            empty: false
        }
    ]
,   username = '';

prompt.message = 'node-cas-sfu';
prompt.start();
prompt.get(prompts, function(err, result) {
    request.post({
        uri: cas.options.casHost + cas.options.casBasePath + '/tickets',
        body: 'username=' + result.username + '&password=' + result.password + '&service=' + cas.options.service + '&allow=' + cas.options.allow
    }, function(err, response, body) {
        assert.equal(response.statusCode, 201);
        var ticketurl = cas.options.casHost + response.headers.location;
        request.post({
            uri: cas.options.casHost + response.headers.location,
            body: 'service=' + cas.options.service
        }, function(err, response, ticket){
            assert.equal(response.statusCode, 200);
            cas.validate(ticket, function(err, loggedIn, casResponse) {
                assert(loggedIn);
                assert.equal(casResponse.user, result.username);

                var apacheuser = 'myfakeuser'
                ,   apachepass = 'pencil69';

                request.post({
                    uri: cas.options.casHost + cas.options.casBasePath + '/tickets',
                    body: 'username=' + apacheuser + '&password=' + apachepass + '&service=' + cas.options.service + '&allow=' + cas.options.allow
                }, function(err, response, body) {
                    assert.equal(response.statusCode, 201);
                    var ticketurl = cas.options.casHost + response.headers.location;
                    request.post({
                        uri: cas.options.casHost + response.headers.location,
                        body: 'service=' + cas.options.service
                    }, function(err, response, ticket){
                        assert.equal(response.statusCode, 200);
                        cas.validate(ticket, function(err, loggedIn, casResponse) {
                            assert(loggedIn);
                            assert.equal(casResponse.user, 'myfakeuser');
                        });
                    });
                });

            });
        });
    });


});