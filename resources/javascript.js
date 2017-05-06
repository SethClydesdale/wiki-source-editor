(function () {
  'use strict';

  window.gh_wiki = {
    step : 1,

    textarea : new SimpleMDE({
      element : document.getElementById('wiki-page-source'),
      spellChecker : false,
      status : false
    }),

    error : {
      not_github : '<span class="error"><i class="fa fa-github"></i> Please input a wiki or repository URL from <a href="https://github.com" target="_blank">github.com</a>.</span>',
      not_found : '<span class="error"><i class="fa fa-warning"></i> <a href="{URL}" target="_blank">{REPO}</a> could not be found. Please check the URL and try again.</span>',
      no_wiki : '<span class="error"><i class="fa fa-frown-o"></i> No wiki pages could be found for <a href="{URL}" target="_blank">{REPO}</a>.</span>'
    },

    // get the github wiki page
    get : function (callback) {
      var url = document.getElementById('get-wiki-url').value,
          result = document.getElementById('wiki-results'),
          user, repo,

          parseVars = function (match) {
            switch (match) {
              case '{URL}' :
                return url;

              case '{REPO}' :
                return repo;
            }
          };

      // only accept URLs from github
      if (url && /github\.com/.test(url)) {
        url = url.replace(/^http(?:s|):\/\/|github\.com\//g, '').split('/');

        // url[0] and [1] should be the user and repo. (i.e. github.com/SethClydesdale[0]/wiki-source-editor[1]/)
        if (url[0] && url[1]) {
          gh_wiki.disableButtons(true);

          user = url[0];
          repo = url[1];

          url = 'https://github.com/' + user + '/' + repo + '/wiki';
          result.innerHTML = 'Getting ' + url + '<span class="ellipsis">.</span>';

          // gets the wiki page with CORS Anywhere since big brother github.com wont play with little brother github.io
          // see https://github.com/Rob--W/cors-anywhere/ for more info
          get(url, function (data) {
            if (data) {
              var pages = data.querySelectorAll('.wiki-page-link'),
                  total = pages.length;


              if (total) {
                result.innerHTML = '';

                gh_wiki.data = {
                  url : url,
                  user : user,
                  repo : repo,
                  pages : pages,
                  total : total,
                  sidebar : data.querySelector('.wiki-custom-sidebar') ? 1 : 0,
                  footer : data.querySelector('#wiki-footer') ? 1 : 0,
                  get : document.getElementById('get-wiki-url').value
                };

                gh_wiki.buildPages();

                if (typeof callback === 'function') {
                  callback();
                }

              } else {
                result.innerHTML = gh_wiki.error.no_wiki.replace(/\{URL\}|\{REPO\}/g, parseVars);
              }

            } else {
              result.innerHTML = gh_wiki.error.not_found.replace(/\{URL\}|\{REPO\}/g, parseVars);
            }

            gh_wiki.disableButtons(false);
          }, {
            any_origin : true
          });

        } else {
          result.innerHTML = gh_wiki.error.not_github;
        }

      } else {
        result.innerHTML = gh_wiki.error.not_github;
      }
    },


    // builds the wiki page list
    buildPages : function () {
      if (gh_wiki.data) {
        var list = document.getElementById('wiki-pages'),
            frag = document.createDocumentFragment(),
            raw = 'https://raw.githubusercontent.com/wiki/' + gh_wiki.data.user + '/' + gh_wiki.data.repo + '/',
            temps = gh_wiki.data.sidebar + gh_wiki.data.footer,
            i = 0,
            file;

        list.innerHTML = '';

        // changes the existing wiki links and adds them to
        for (; i < gh_wiki.data.total; i++) {
          file = gh_wiki.data.pages[i].href.split('/').pop();

          gh_wiki.data.pages[i].href = raw + (file == 'wiki' ? 'Home' : file) + '.md';
          gh_wiki.data.pages[i].addEventListener('click', function (e) {
            gh_wiki.getSource(this);
            e.preventDefault();
          });

          frag.appendChild(gh_wiki.data.pages[i].parentNode.parentNode);
        }

        document.getElementById('wiki-pages-info').innerHTML = 'Showing <strong>' + gh_wiki.data.total + '</strong> wiki page' + ( gh_wiki.data.total == 1 ? '' : 's' ) + ' ' + ( temps ? 'and <strong>' + temps + '</strong> template' + ( temps == 1 ? '' : 's' ) + ' ' : '' ) + 'from <a href="' + gh_wiki.data.url + '" target="_blank">' + gh_wiki.data.repo + '</a>.';
        list.appendChild(frag);

        // add additional templates
        if (temps) {
          list.insertAdjacentHTML('beforeend',
            (gh_wiki.data.sidebar ? '<li class="wiki-more-pages"><strong><a class="wiki-page-link wiki-page-template" href="' + raw + '_Sidebar.md" onclick="gh_wiki.getSource(this); return false;">_Sidebar</a></strong></li>' : '')+
            (gh_wiki.data.footer ? '<li class="wiki-more-pages"><strong><a class="wiki-page-link wiki-page-template" href="' + raw + '_Footer.md" onclick="gh_wiki.getSource(this); return false;">_Footer</a></strong></li>' : '')
          );
        }

        // update page data
        gh_wiki.data.pages = document.querySelectorAll('.wiki-page-link');
        gh_wiki.data.total = gh_wiki.data.pages.length;

        gh_wiki.next();
        gh_wiki.setCopyURL();
      }
    },


    getSource : function (caller) {
      var file = caller.href.split('/').pop().replace('.md', '');
      gh_wiki.data.page = caller.innerText;
      gh_wiki.data.intialSource = true;

      document.getElementById('wiki-page-title').innerHTML = caller.innerHTML;
      document.getElementById('wiki-page-actions').innerHTML =
      '<a href="' + caller.href + '" target="_blank">Raw</a>'+
      '<a href="' + gh_wiki.data.url + '/' + ( /Home|_Sidebar|_Footer/.test(file) ? '' : file ) + '" target="_blank">Current</a>'+
      '<a href="' + gh_wiki.data.url + '/' + file + '/_history" target="_blank">History</a>';

      gh_wiki.textarea.value('Fetching source...');
      document.getElementById('diff-raw').innerHTML = '';
      document.getElementById('diff-rendered').innerHTML = '';

      get(caller.href, function (data) {
        gh_wiki.data.original = data;
        gh_wiki.data.loaded = true;

        if (!gh_wiki.user_source) {
          gh_wiki.textarea.value(data || 'Page not available. The source path may have been changed by the owner.');

        } else {
          gh_wiki.user_source = false;
        }

        gh_wiki.data.intialSource = false;
      }, {
        data : 'plain'
      });

      gh_wiki.next();
      gh_wiki.setCopyURL();
    },


    // compares the original wiki source against the currently modified source
    viewDiff : function () {
      var diff = JsDiff.diffChars(gh_wiki.data.original, gh_wiki.textarea.value()),
          raw = document.getElementById('diff-raw'),
          rendered = document.getElementById('diff-rendered'),
          raw_html = '',
          ren_html = '',
          color, span, c;

      diff.forEach(function (part){
        c = part.added ? 'diff-addition' : part.removed ? 'diff-deletion' : 'diff-same';
        raw_html += '<span class="' + c + '">' + part.value.replace(/<|>/g, function (match) { return match == '<' ? '&lt;' : '&gt;' }) + '</span>';
        ren_html += '<span class="' + c + '">' + part.value + '</span>';
      });

      raw.innerHTML = raw_html.replace(/(?:\n|)(.*?)(?:\n|$)/g, '<p>$1</p>');
      rendered.innerHTML = gh_wiki.textarea.options.previewRender(ren_html);

      for (var a = document.querySelectorAll('.diff-content > *'), i = 0, j = a.length; i < j; i++) {
        if (a[i].querySelector('.diff-addition')) {
          a[i].className += ' highlight-addition';
        }

        if (a[i].querySelector('.diff-deletion')) {
          a[i].className += ' highlight-deletion';
        }
      }

      window.scrollTo(0, document.getElementById('wiki-diff-title').offsetTop);

      if (!gh_wiki.data.diff) {
        gh_wiki.data.diff = true;
        gh_wiki.setCopyURL();
      }
    },

    // clears the diff comparison
    clearDiff : function () {
      document.getElementById('diff-raw').innerHTML = '';
      document.getElementById('diff-rendered').innerHTML = '';

      gh_wiki.data.diff = false;
    },


    // searches the wiki pages for the specified string
    filterPages : function (str) {
      for (var i = 0, str = str || ''; i < gh_wiki.data.total; i++) {
        gh_wiki.data.pages[i].style.display = gh_wiki.data.pages[i].innerText.toLowerCase().indexOf(str.toLowerCase()) != -1 ? '' : 'none';
      }
    },

    // resets the page filter
    resetFilter : function () {
      var search = document.getElementById('wiki-page-search');

      if (search.value) {
        search.value = '';
        gh_wiki.filterPages();
      }
    },


    // sets the copy url value
    setCopyURL : function () {
      document.querySelector('#step-' + gh_wiki.step + ' .copy-button').dataset.clipboardText =
      window.location.href.replace(/\?.*/, '') + '?get=' + encodeURIComponent(gh_wiki.data.get) +
      (gh_wiki.data.page ? '&page=' + encodeURIComponent(gh_wiki.data.page) : '') +
      (gh_wiki.data.value ? '&value=' + LZString.compressToEncodedURIComponent(gh_wiki.data.value) : '') +
      (gh_wiki.data.diff ? '&diff=true' : '');
    },


    // moves forward to the next step
    next : function () {
      if (gh_wiki.step != 3) {
        gh_wiki.resetFilter();

        document.getElementById('step-' + gh_wiki.step).dataset.hidden = true;
        document.getElementById('step-' + ++gh_wiki.step).dataset.hidden = false;
      }
    },


    // moves back to the previous step
    back : function () {
      if (gh_wiki.step != 1) {

        if (!gh_wiki.data.valueChanged || (gh_wiki.data.valueChanged && confirm('Are you sure you want to go back? Any changes you made will be lost.'))) {
          if (gh_wiki.step == 3) {
            if (gh_wiki.textarea.isPreviewActive()) {
              document.querySelector('.editor-toolbar .fa-eye').click();
            }

            if (gh_wiki.data.valueChanged) {
              gh_wiki.data.valueChanged = false;
            }
          }

          document.getElementById('step-' + gh_wiki.step).dataset.hidden = true;
          document.getElementById('step-' + --gh_wiki.step).dataset.hidden = false;
        }

        if (gh_wiki.step == 2) {
          gh_wiki.resetFilter();
          gh_wiki.setCopyURL();
        }

      }
    },


    // get a random wiki from the showcases
    random : {

      showcases : [
        'devops-tools',
        'virtual-reality',
        'software-defined-radio',
        'tools-for-open-source',
        'open-source-integrations',
        'serverless-architecture',
        'emoji',
        'web-application-frameworks',
        'hacking-minecraft',
        'web-accessibility',
        'github-browser-extensions',
        'great-for-new-contributors',
        'productivity-tools',
        'javascript-game-engines',
        'projects-that-power-github-for-mac',
        'game-engines',
        'debug-politics',
        'programming-languages',
        'projects-with-great-wikis',
        'music',
        'government',
        'projects-that-power-github',
        'social-impact',
        'data-visualization',
        'science',
        'swift',
        'open-data',
        'fonts',
        'text-editors',
        'fabric-mobile-developer-tools',
        'package-managers',
        'clean-code-linters',
        'open-source-operating-systems',
        'open-journalism',
        'machine-learning',
        'front-end-javascript-frameworks',
        'ember-projects',
        'made-in-africa',
        'security',
        'design-essentials',
        'universal-2nd-factor',
        'github-pages-examples',
        'projects-that-power-github-for-windows',
        'web-games',
        'game-off-winners',
        'open-source-organizations',
        'policies',
        'css-preprocessors',
        'icon-fonts',
        'video-tools',
        'writing',
        '3d-modeling',
        'nosql-databases',
        'software-development-tools'
      ],

      roll : function () {
        var showcase = 'https://github.com/showcases/' + gh_wiki.random.showcases[Math.floor(Math.random() * gh_wiki.random.showcases.length)];

        document.getElementById('wiki-results').innerHTML = 'Getting '+ showcase + '<span class="ellipsis">.</span>';
        gh_wiki.disableButtons(true);

        get(showcase, function (data) {
          if (data) {
            var wiki = data.querySelectorAll('.repo-list-item .mb-1 a');
            document.getElementById('get-wiki-url').value = 'github.com' + wiki[Math.floor(Math.random() * wiki.length)].getAttribute('href');
            gh_wiki.get();

            gh_wiki.disableButtons(false);
          }
        }, {
          any_origin : true
        });
      }

    },


    // disables / enables buttons that use any_origin
    disableButtons : function (disabled) {
      var buttons = [
        document.getElementById('get-wiki'),
        document.getElementById('random-repo')

      ], i = 0, j = buttons.length;

      for (; i < j; i++) {
        buttons[i].dataset.disabled = disabled;
      }
    }

  };


  // get the wiki when the GET button is clicked or ENTER button is pressed
  document.getElementById('get-wiki').addEventListener('click', gh_wiki.get);
  document.getElementById('get-wiki-url').addEventListener('keyup', function (e) {
    if ({
      'Enter' : 1,
      '13' : 1
    }[e.key || e.keyCode]) {
      gh_wiki.get();
    }
  });


  // get a random repo
  document.getElementById('random-repo').addEventListener('click', gh_wiki.random.roll);


  // add event listener to page filter
  document.getElementById('wiki-page-search').addEventListener('keyup', function () {
    gh_wiki.filterPages(this.value);
  });


  // goes back to a previous step when the back button is clicked
  for (var button = document.querySelectorAll('.back-button'), i = 0, j = button.length; i < j; i++) {
    button[i].addEventListener('click', gh_wiki.back);
  }


  // copies the page URL
  new Clipboard('.copy-button', {
    target : function (trigger) {
      return trigger;
    }
  }).on('success', function (e) {
    var trigger = e.trigger;

    if (trigger.innerHTML != trigger.dataset.success) {
      trigger.dataset.original = trigger.innerHTML;
      trigger.innerHTML = trigger.dataset.success;

      window.setTimeout(function() {
        trigger.innerHTML = trigger.dataset.original;
      }, 1000);
    }
  });


  // updates the copy URL when the wiki source changes
  gh_wiki.textarea.codemirror.on('change', function () {
    if (!gh_wiki.data.intialSource) {
      gh_wiki.data.valueChanged = true;
      gh_wiki.data.value = gh_wiki.textarea.value();

      if (gh_wiki.data.diff) {
        gh_wiki.clearDiff();
      }

      gh_wiki.setCopyURL();
    }
  });

  // warn before leaving, if the source was modified
  window.onbeforeunload = function(e) {
    if (gh_wiki.data.valueChanged) {
      var warn = 'Are you sure you want to leave this page? Any changes you made will be lost.';
      e.returnValue = warn;
      return warn;
    }
  };


  // compare the original and modified wiki source
  document.getElementById('view-diff').addEventListener('click', gh_wiki.viewDiff);

  // change between raw and rendered diff views
  for (var a = document.querySelectorAll('#diff-views a'), i = 0, j = a.length; i < j; i++) {
    a[i].addEventListener('click', function (e) {
      var active = this.parentNode.querySelector('.active');

      document.getElementById(active.getAttribute('href').slice(1)).style.display = 'none';
      active.className = active.className.replace('active', '');

      document.getElementById(this.getAttribute('href').slice(1)).style.display = '';
      this.className = 'active';

      e.preventDefault();
    });
  }


  // parses and applies the URL's query string params
  // get=repo_url (repo you want to view)
  // page=page_name (page in the repo to open)
  // value=editor_value (new/modified source code for the wiki)
  // diff=true (auto-view diff on visit)
  if (window.location.search) {
    var params = window.location.search.slice(1).split('&'),
        data = {},
        i = 0,
        j = params.length,
        keyValue;

    // parse the params as an object
    for (; i < j; i++) {
      keyValue = params[i].split('=');
      data[keyValue[0]] = keyValue[0] == 'value' ?
                          LZString.decompressFromEncodedURIComponent(keyValue[1]) :
                          decodeURIComponent(keyValue[1]);
    }

    // apply the values
    if (data.get) {
      document.getElementById('get-wiki-url').value = data.get;

      gh_wiki.get(function () {
        if (data.page) {
          for (var page = document.querySelectorAll('.wiki-page-link'), i = 0, j = page.length; i < j; i++) {
            if (page[i].innerText.toLowerCase() == data.page.toLowerCase()) {
              page[i].click();

              if (data.value) {
                gh_wiki.user_source = true;
                gh_wiki.data.value = data.value;
                gh_wiki.textarea.value(data.value);

                if (data.diff) {
                  gh_wiki.awaitDiff = window.setInterval(function () {
                    if (gh_wiki.data.loaded) {
                      window.clearInterval(gh_wiki.awaitDiff);
                      gh_wiki.viewDiff();
                    }
                  }, 100);

                } else {
                  gh_wiki.setCopyURL();
                }
              }

              break;
            }
          }
        }
      });
    }

  } else {
    document.getElementById('get-wiki-url').focus();
  }

}());
