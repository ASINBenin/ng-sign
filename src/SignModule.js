(function () {
  'use strict';

  angular
    .module('SignModule', ['ngMaterial', 'ui.router'])
    .constant('SignConfig', {
      bjeTokenDriverUrl: 'https://127.0.0.1:42304'
    })
    .config([
      '$stateProvider',
      function ($stateProvider) {
        $stateProvider
          // Routes de la signature électronique (états enfants de l'ANR)
          .state('main.project.anr.signatureList', {
            url: '/signatures',
            views: {
              'anr@main.project.anr': {
                templateUrl: 'views/sign/signature.list.html',
                controller: 'SignatureListCtrl',
              },
            },
            ncyBreadcrumb: {
              label: '{{ "Processus de signature" | translate }}',
            },
            params: {
              modelId: null
            },
          })
          .state('main.project.anr.signatureProcess', {
            url: '/signature-process/:requestId?signatureSuccess',
            views: {
              'main@main': {
                templateUrl: 'views/sign/signature.process.html',
                controller: 'SignatureProcessCtrl',
              },
            },
            ncyBreadcrumb: {
              label: '{{ "Processus de signature" | translate }}',
            },
            params: {
              modelId: null,
              requestId: null,
              signatureSuccess: null,
            },
          })
          .state('main.project.anr.signatureCallback', {
            url: '/signature-callback/:requestId?status&signatureSuccess&signatureError',
            views: {
              'main@main': {
                templateUrl: 'views/sign/signature.callback.html',
                controller: 'SignatureCallbackCtrl',
              },
            },
            ncyBreadcrumb: {
              label: '{{ "Processus de signature" | translate }}',
            },
            params: {
              modelId: null,
              requestId: null,
              status: null,
              signatureSuccess: null,
              signatureError: null,
            },
          })
          .state('main.project.anr.signatureSetup', {
            url: '/signature-setup/:requestId',
            views: {
              'main@main': {
                templateUrl: 'views/sign/signature.setup.html',
                controller: 'SignatureSetupCtrl',
              },
            },
            ncyBreadcrumb: {
              label: '{{ "Préparation de la signature" | translate }}',
            },
            params: {
              modelId: null,
              requestId: null,
            },
          });
      },
    ]);
})();
