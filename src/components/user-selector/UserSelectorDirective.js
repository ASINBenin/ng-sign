(function () {
  'use strict';

  angular
    .module('SignModule')
    .directive('userSelector', [
      'SignatureRequestService',
      'gettextCatalog',
      function (SignatureRequestService, gettextCatalog) {
        return {
          restrict: 'E',
          scope: {
            selectedUser: '=',
            onSelect: '&?',
            placeholder: '@?'
          },
          template: '<div class="sig-user-selector-wrapper">' +
                    '  <md-autocomplete ' +
                    '      md-selected-item="selectedUser" ' +
                    '      md-search-text="searchText" ' +
                    '      md-items="item in queryUsers(searchText)" ' +
                    '      md-item-text="getUserFullName(item)" ' +
                    '      md-selected-item-change="selectedItemChanged(item)" ' +
                    '      md-min-length="0" ' +
                    '      md-no-cache="true" ' +
                    '      md-clear-button="true" ' +
                    '      placeholder="{{ placeholder || defaultPlaceholder }}">' +
                    '    <md-item-template>' +
                    '      <div layout="row" layout-align="start center" style="padding: 2px 0;">' +
                    '        <span md-highlight-text="searchText" class="sig-user-item-name" style="font-size: 13px; font-weight: 600; color: #1e293b;">{{ item.firstname }} {{ item.lastname }}</span>' +
                    '        <span class="sig-user-item-email" style="font-size: 11.5px; color: #64748b; margin-left: 8px;">({{ item.email }})</span>' +
                    '      </div>' +
                    '    </md-item-template>' +
                    '    <md-not-found>' +
                    '      <span style="font-size: 12px; color: #64748b; padding: 6px 12px; display: inline-block;">{{ notFoundLabel }} "{{ searchText }}".</span>' +
                    '    </md-not-found>' +
                    '  </md-autocomplete>' +
                    '</div>',
          link: function (scope) {
            scope.defaultPlaceholder = gettextCatalog.getString('Choose a user...');
            scope.notFoundLabel = gettextCatalog.getString('No user found for');

            scope.getUserFullName = function (item) {
              if (!item) return '';
              var name = ((item.firstname || '') + ' ' + (item.lastname || '')).trim();
              return name || item.email || '';
            };

            scope.queryUsers = function (text) {
              if (scope.selectedUser && scope.getUserFullName(scope.selectedUser) === text) {
                return [scope.selectedUser];
              }
              return SignatureRequestService.searchUsers(text).then(function (users) {
                return users || [];
              });
            };

            scope.selectedItemChanged = function (item) {
              if (scope.onSelect && item) {
                scope.onSelect({ user: item });
              }
            };
          }
        };
      }
    ]);
})();