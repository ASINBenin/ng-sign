(function () {
  'use strict';

  angular
    .module('SignModule')
    .service('SignatureRequestService', [
      '$http',
      '$q',
      '$state',
      'toastr',
      function ($http, $q, $state, toastr) {
        var self = this;
        var cachedUsers = null;
        var usersPromise = null;

        this.getSignatureRequests = function (modelId) {
          if (!modelId) {
            return $q.reject(new Error("Identifiant modelId requis"));
          }
          return $http.get('api/anrs/' + modelId + '/signature-requests')
            .then(function (res) { return res.data; });
        };

        this.getSignatureRequest = function (modelId, requestId) {
          if (!modelId || !requestId) {
            return $q.reject(new Error("Identifiant modelId et requestId requis"));
          }
          return $http.get('api/anrs/' + modelId + '/signature-requests/' + requestId)
            .then(function (res) { return res.data; });
        };

        this.createSignatureRequest = function (payload, modelId) {
          if (!modelId) {
            return $q.reject(new Error("Identifiant modelId requis"));
          }
          return $http.post('api/anrs/' + modelId + '/signature-requests', payload)
            .then(function (res) { return res.data; });
        };

        this.initiateSignatureForDeliverable = function (deliverable, modelId) {
          var targetModelId = modelId || (deliverable && deliverable.anr ? deliverable.anr.id : null);
          if (!targetModelId) {
            if (toastr) toastr.error("Impossible d'identifier l'analyse de risques courante.");
            return $q.reject(new Error("Identifiant modelId manquant"));
          }

          var typeDoc = (deliverable && (deliverable.typedoc || deliverable.category)) ? (deliverable.typedoc || deliverable.category) : null;
          if (!typeDoc) {
            if (toastr) toastr.error("Type de document non spécifié pour le livrable.");
            return $q.reject(new Error("Type de document requis"));
          }

          var deliverableParams = angular.copy(deliverable || {});
          deliverableParams.deliverableDocType = typeDoc;
          deliverableParams.typedoc = typeDoc;
          var defaultTitle = deliverableParams.docname || deliverableParams.name || deliverableParams.title || 'Untitled-Deliverable';
          deliverableParams.docname = defaultTitle;
          deliverableParams.name = defaultTitle;
          deliverableParams.title = defaultTitle;

          if (toastr) {
            toastr.info("Initialisation de la demande de signature...");
          }

          return self.createSignatureRequest(deliverableParams, targetModelId).then(function (data) {
            var reqId = (data && (data.requestId || data.id)) ? (data.requestId || data.id) : null;
            if ($state) {
              $state.go('main.project.anr.signatureSetup', {
                modelId: targetModelId,
                requestId: reqId
              });
            }
            return data;
          }).catch(function (err) {
            if (toastr) {
              toastr.error("Erreur lors de l'initialisation de la demande de signature");
            }
            return $q.reject(err);
          });
        };

        this.updateSignatories = function (modelId, requestId, signatories) {
          if (!modelId || !requestId) {
            return $q.reject(new Error("Identifiants requis"));
          }
          return $http.put('api/anrs/' + modelId + '/signature-requests/' + requestId, { signatories: signatories })
            .then(function (res) { return res.data; });
        };

        this.deleteSignatureRequest = function (modelId, requestId) {
          if (!modelId || !requestId) {
            return $q.reject(new Error("Identifiants requis"));
          }
          return $http.delete('api/anrs/' + modelId + '/signature-requests/' + requestId)
            .then(function (res) { return res.data; });
        };

        this.getPdfUrl = function (requestId) {
          return 'api/signature-requests/' + requestId + '/pdf';
        };

        function filterUsers(list, query) {
          var q = (query || '').toLowerCase().trim();
          if (!q) return list;
          return list.filter(function (u) {
            var fn = (u.firstname || '').toLowerCase();
            var ln = (u.lastname || '').toLowerCase();
            var fullname = (fn + ' ' + ln).trim();
            var email = (u.email || '').toLowerCase();
            return fullname.indexOf(q) !== -1 || email.indexOf(q) !== -1 || fn.indexOf(q) !== -1 || ln.indexOf(q) !== -1;
          });
        }

        this.searchUsers = function (query) {
          if (cachedUsers) {
            return $q.resolve(filterUsers(cachedUsers, query));
          }

          if (!usersPromise) {
            usersPromise = $http.get('api/users').then(function (res) {
              var rawList = [];
              if (res && res.data) {
                rawList = angular.isArray(res.data) ? res.data : (res.data.users || res.data.list || []);
              }
              cachedUsers = rawList;
              return cachedUsers;
            }).catch(function (err) {
              console.error('Error fetching users:', err);
              usersPromise = null;
              return [];
            });
          }

          return usersPromise.then(function (users) {
            return filterUsers(users, query);
          });
        };
      },
    ]);
})();