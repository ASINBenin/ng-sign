(function () {
  'use strict';

  angular
    .module('SignModule')
    .directive('signatoryCard', [
      'gettextCatalog',
      function (gettextCatalog) {
        return {
          restrict: 'E',
          scope: {
            signatory: '=',
            isSelected: '=?',
            isCurrent: '=?',
            currentPage: '=?',
            currentUserId: '=?',
            onSelect: '&?',
            onDelete: '&?',
            onRemove: '&?',
            readOnly: '=?'
          },
          template: '<div class="sig-card" ng-class="{\'sig-card-active\': isSelected || isCurrent}" ng-click="selectCard($event)" style="border-left-color: {{ signatory.color || \'#006fba\' }};">' +
                    '  <div class="sig-card-header" layout="row" layout-align="space-between start">' +
                    '    <div class="sig-card-user-info" layout="row" layout-align="start center" flex>' +
                    '      <div class="sig-card-badge" ng-style="{\'background-color\': signatory.color || \'#006fba\'}">{{ signatory.order || 1 }}</div>' +
                    '      <div class="sig-card-details" flex>' +
                    '        <div ng-if="signatory.user" class="sig-card-name">{{ signatory.user.firstname }} {{ signatory.user.lastname }}</div>' +
                    '        <div ng-if="signatory.user" class="sig-card-email">{{ signatory.user.email }}</div>' +
                    '        <span ng-if="signatory.user && currentUserId && (signatory.user.id == currentUserId)" class="sig-card-tag-you">{{ labels.you }}</span>' +
                    '        <div ng-if="!signatory.user" class="sig-card-unassigned">{{ labels.newSignatory }}</div>' +
                    '      </div>' +
                    '    </div>' +
                    '    <div class="sig-card-actions" layout="row" layout-align="end center" ng-if="!readOnly">' +
                    '      <md-button class="md-icon-button sig-action-btn sig-edit-btn" ng-if="signatory.user" ng-click="editCard($event)" title="{{ labels.changeUser }}" aria-label="{{ labels.edit }}">' +
                    '        <md-icon>edit</md-icon>' +
                    '      </md-button>' +
                    '      <md-button class="md-icon-button sig-action-btn sig-delete-btn" ng-click="deleteCard($event)" title="{{ labels.deleteSignatory }}" aria-label="{{ labels.delete }}">' +
                    '        <md-icon>delete</md-icon>' +
                    '      </md-button>' +
                    '    </div>' +
                    '  </div>' +
                    '  <div ng-if="!signatory.user" class="sig-card-selector" ng-click="$event.stopPropagation()">' +
                    '    <user-selector selected-user="signatory.user" placeholder="{{ labels.chooseUser }}"></user-selector>' +
                    '  </div>' +
                    '  <div class="sig-card-footer" layout="row" layout-align="space-between center">' +
                    '    <span class="sig-card-pos">{{ labels.page }} {{ signatory.page || 1 }}</span>' +
                    '    <button type="button" class="sig-page-switch-btn" ng-if="signatory.page && signatory.page != currentPage" ng-click="moveToCurrentPage($event)">' +
                    '      {{ labels.moveToPage }} {{ currentPage }}' +
                    '    </button>' +
                    '  </div>' +
                    '</div>',
          link: function (scope) {
            scope.labels = {
              you: gettextCatalog.getString('You'),
              newSignatory: gettextCatalog.getString('New signatory'),
              changeUser: gettextCatalog.getString('Change user'),
              edit: gettextCatalog.getString('Edit'),
              deleteSignatory: gettextCatalog.getString('Delete this signatory'),
              delete: gettextCatalog.getString('Delete'),
              chooseUser: gettextCatalog.getString('Choose a user...'),
              page: gettextCatalog.getString('Page'),
              moveToPage: gettextCatalog.getString('Move to page')
            };

            scope.selectCard = function (ev) {
              if (scope.onSelect) {
                scope.onSelect({ sig: scope.signatory });
              }
            };

            scope.editCard = function (ev) {
              ev.stopPropagation();
              scope.signatory.user = null;
            };

            scope.deleteCard = function (ev) {
              ev.stopPropagation();
              if (scope.onDelete) {
                scope.onDelete({ sig: scope.signatory });
              } else if (scope.onRemove) {
                scope.onRemove({ signatory: scope.signatory });
              }
            };

            scope.moveToCurrentPage = function (ev) {
              ev.stopPropagation();
              if (scope.signatory && scope.currentPage) {
                scope.signatory.page = scope.currentPage;
                if (scope.onSelect) {
                  scope.onSelect({ sig: scope.signatory });
                }
              }
            };
          }
        };
      }
    ]);
})();