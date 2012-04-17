var cleanCasResponse = module.exports.cleanCasResponse = function(str) {
	// strip off 'cas:' namespaces from XML documents
	return str.replace(/cas:/g, '');
};

var parseUserFile = module.exports.parseUserFile = function(file) {
    /* assumes a file in pattern
        username:ENCRYPTEDPASSWORD
    */
    var users = {}, f;

    try {
        f = require('fs').readFileSync(file, 'utf-8');
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

