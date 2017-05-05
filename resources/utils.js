function get (url, callback, opts) {
  var xhttp = new XMLHttpRequest();

  xhttp.onreadystatechange = function() {
    if (this.readyState == 4) {
      switch (this.status) {
        // all good 8)
        case 200 :
          if (opts.data == 'plain') {
            callback(this.responseText);

          } else {
            var data = document.createElement('DIV');
            data.innerHTML = this.responseText;
            callback(data);
          }
          break;

        // we're lost! O_O
        case 404 :
          callback(null);
          break;

        // no headers? what the!?
        case 400 :
          if (opts.any_origin) {
            xhttp.open('get', url, true);
            xhttp.send();
          }
          break;

        // still feeling kinda empty..
      }
    }
  };

  xhttp[opts.any_origin ? 'openAnyOrigin' : 'open']('get', url, true);
  xhttp.send();
};


// https://github.com/Rob--W/cors-anywhere/
(function() {
  var cors_api_host = 'cors-anywhere.herokuapp.com';
  var cors_api_url = 'https://' + cors_api_host + '/';
  var slice = [].slice;
  var origin = window.location.protocol + '//' + window.location.host;
  var open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.openAnyOrigin = function() {
    var args = slice.call(arguments);
    var targetOrigin = /^https?:\/\/([^\/]+)/i.exec(args[1]);
    if (targetOrigin && targetOrigin[0].toLowerCase() !== origin &&
        targetOrigin[1] !== cors_api_host) {
        args[1] = cors_api_url + args[1];
    }
    return open.apply(this, args);
  };
})();
