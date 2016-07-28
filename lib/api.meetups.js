/*!
 * Copyright 2014 Apereo Foundation (AF) Licensed under the
 * Educational Community License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may
 * obtain a copy of the License at
 *
 *     http://opensource.org/licenses/ECL-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an "AS IS"
 * BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

var _ = require('underscore');

var AuthzAPI = require('oae-authz');
var AuthzConstants = require('oae-authz/lib/constants').AuthzConstants;
var AuthzInvitations = require('oae-authz/lib/invitations');
var AuthzPermissions = require('oae-authz/lib/permissions');
var AuthzUtil = require('oae-authz/lib/util');
var LibraryAPI = require('oae-library');
var log = require('oae-logger').logger('meetings-api');
var MessageBoxAPI = require('oae-messagebox');
var MessageBoxConstants = require('oae-messagebox/lib/constants').MessageBoxConstants;
var OaeUtil = require('oae-util/lib/util');
var PrincipalsUtil = require('oae-principals/lib/util');
var PrincipalsDAO = require('oae-principals/lib/internal/dao');
var ResourceActions = require('oae-resource/lib/actions');
var Signature = require('oae-util/lib/signature');
var Validator = require('oae-authz/lib/validator').Validator;

var MeetingsAPI = require('oae-bbb');
var MeetingsConfig = require('oae-config').config('oae-bbb');
var MeetingsConstants = require('./constants').MeetingsConstants;
var MeetingsDAO = require('./internal/dao');

var BBBProxy = require('./internal/proxy');

var joinURL = module.exports.joinURL = function(req, profile, dummy, callback) {
    // Prepare parameters to be send based on parameters received
    var fullName = encodeURIComponent(req.oaeAuthInfo.user.displayName);
    var meetingID = sha1(meetingProfile.id + bbbConfig.secret);
    var meetingName = encodeURIComponent(meetingProfile.displayName);

    MeetingsAPI.Bbb.getMeetingInfo(req, meetingProfile, function(err, info) {
        if(err) {
            res.send(503, 'Fatal error');
        }
    });

    // Make sure the meeting is running
    var params = {'meetingID': meetingID};
    var meetingInfoURL = _getBBBActionURL(bbbConfig.endpoint, 'getMeetingInfo', bbbConfig.secret, _getQueryStringParams(params));
    BBBProxy.executeBBBCall(meetingInfoURL, function(err, meetingInfo) {
        if (err) {
            return callback(err);
        }

        if ( meetingInfo.returncode == 'FAILED' && meetingInfo.messageKey == 'notFound' ) {
            // Force parameter to false when recording is disabled
            if (typeof meetingProfile.record != 'undefined') {
                record = Config.getValue(req.ctx.tenant().alias, 'bbb', 'recording')? meetingProfile.record: false;
            } else {
                record = Config.getValue(req.ctx.tenant().alias, 'bbb', 'recording')? Config.getValue(req.ctx.tenant().alias, 'bbb', 'recordingDefault'): false;
            }
            if ( typeof meetingProfile.resourceURI != 'undefined' ) {
                resourceURI = meetingProfile.resourceURI;
            } else {
                resourceURI = meetingProfile.profilePath;
            }
            // Create the meeting
            var params = {'meetingID': meetingID, 'name':meetingName, 'logoutURL': req.protocol+'://'+req.host+resourceURI+'/close', 'record': record};
            var createMeetingURL = _getBBBActionURL(bbbConfig.endpoint, 'create', bbbConfig.secret, _getQueryStringParams(params));
            BBBProxy.executeBBBCall(createMeetingURL, function(err, meetingInfo) {
                if (err) {
                    return callback(err);
                }

                // Construct and sign the URL
                var password = _getJoiningPassword(meetingProfile, meetingInfo);
                var params = {'meetingID': meetingID, 'fullName':fullName, 'password': password};
                /**********************/
                if( configXML != null && configXML != '' ) {
                    var config_xml_params = _getSetConfigXMLParams(bbbConfig.secret, meetingID, configXML);
                    var setConfigXMLURL = bbbConfig.endpoint + 'api/setConfigXML';
                    console.info(setConfigXMLURL);
                    BBBProxy.executeBBBCallExtended(setConfigXMLURL, null, 'post', config_xml_params, 'application/x-www-form-urlencoded', function(err, response) {
                        if (err || response.returncode == 'FAILED') {
                            var joinURL = _getBBBActionURL(bbbConfig.endpoint, 'join', bbbConfig.secret, _getQueryStringParams(params));
                            return callback(null, {'returncode':'success','url': joinURL});
                        } else {
                            params.configToken = response.configToken;
                            var joinURL = _getBBBActionURL(bbbConfig.endpoint, 'join', bbbConfig.secret, _getQueryStringParams(params));
                            return callback(null, {'returncode':'success','url': joinURL});
                        }
                    });
                } else {
                    var joinURL = _getBBBActionURL(bbbConfig.endpoint, 'join', bbbConfig.secret, _getQueryStringParams(params));
                    return callback(null, {'returncode':'success','url': joinURL});
                }
                /**********************/
            });

        } else {
            // Construct and sign the URL
            var password = _getJoiningPassword(meetingProfile, meetingInfo);
            var params = {'meetingID': meetingID, 'fullName':fullName, 'password': password};
            /**********************/
            if( configXML != null && configXML != '' ) {
                var config_xml_params = _getSetConfigXMLParams(bbbConfig.secret, meetingID, configXML);
                var setConfigXMLURL = bbbConfig.endpoint + 'api/setConfigXML';
                console.info(setConfigXMLURL);
                BBBProxy.executeBBBCallExtended(setConfigXMLURL, null, 'post', config_xml_params, 'application/x-www-form-urlencoded', function(err, response) {
                    if (err || response.returncode == 'FAILED') {
                        var joinURL = _getBBBActionURL(bbbConfig.endpoint, 'join', bbbConfig.secret, _getQueryStringParams(params));
                        return callback(null, {'returncode':'success','url': joinURL});
                    } else {
                        params.configToken = response.configToken;
                        var joinURL = _getBBBActionURL(bbbConfig.endpoint, 'join', bbbConfig.secret, _getQueryStringParams(params));
                        return callback(null, {'returncode':'success','url': joinURL});
                    }
                });
            } else {
                var joinURL = _getBBBActionURL(bbbConfig.endpoint, 'join', bbbConfig.secret, _getQueryStringParams(params));
                return callback(null, {'returncode':'success','url': joinURL});
            }
            /**********************/
        }
    });
    /*
    MeetingsAPI.Bbb.getDefaultConfigXML(req, function(err, result) {
        if(err || result.returncode != 'success') {
            res.send(503, 'Fatal error');
        } else {
            defaultConfigXML = result.defaultConfigXML;
            var serializer = new XMLSerializer();
            var doc = new DOMParser().parseFromString(defaultConfigXML);
            var select = xpath.useNamespaces();
            var node;

            //// set layout bbb.layout.name.videochat and others
            node = select('//layout ', doc, true);
            node.setAttribute('defaultLayout', 'bbb.layout.name.videochat');
            node.setAttribute('showLayoutTools', 'false');
            node.setAttribute('confirmLogout', 'false');
            node.setAttribute('showRecordingNotification', 'false');
            //// process modules
            ////// remove desktop sharing
            node = xpath.select1("//modules/module[@name=\'DeskShareModule\']", doc);
            node.setAttribute('showButton', 'false');
            //// remove PhoneModule button
            node = xpath.select1("//modules/module[@name=\'PhoneModule\']", doc);
            node.setAttribute('showButton', 'true');
            node.setAttribute('skipCheck', 'true');
            node.setAttribute('listenOnlyMode', 'false');
            //// remove VideoconfModule button
            node = xpath.select1("//modules/module[@name=\'VideoconfModule\']", doc);
            node.setAttribute('showButton', 'true');
            node.setAttribute('autoStart', 'true');
            node.setAttribute('skipCamSettingsCheck', 'true');
            //// remove layout menu
            node = xpath.select1("//modules/module[@name=\'LayoutModule\']", doc);
            node.setAttribute('enableEdit', 'false');

            var xml = serializer.serializeToString(doc);
            MeetingsAPI.Bbb.joinURL(req, profile, xml, function(err, joinInfo) {
                if(err) {
                    res.send(503, 'Fatal error');
                }

                //Join the meetup
                res.writeHead(301, {Location: joinInfo.url} );
                res.end();

                MeetingsAPI.emit(MeetupsConstants.events.JOIN_MEETUP, req.ctx, groupProfile, function(errs) {

                });
            });
        }
    });
*/    
};

var getConfigXML = module.exports.getConfigXML = function(req, callback) {

    MeetingsAPI.Bbb.getDefaultConfigXML(req, function(err, result) {
        if(err || result.returncode != 'success') {
            res.send(503, 'Fatal error');
        } else {
            meetupConfigXML = _getMeetupConfigXML(result.defaultConfigXML);

            return callback(null, {'returncode':'success','configXML': meetupConfigXML});
        }
    });
};

var _getMeetupConfigXML = function(configXML) {
    var serializer = new XMLSerializer();
    var doc = new DOMParser().parseFromString(defaultConfigXML);
    var select = xpath.useNamespaces();
    var node;

    //// set layout bbb.layout.name.videochat and others
    node = select('//layout ', doc, true);
    node.setAttribute('defaultLayout', 'bbb.layout.name.videochat');
    node.setAttribute('showLayoutTools', 'false');
    node.setAttribute('confirmLogout', 'false');
    node.setAttribute('showRecordingNotification', 'false');
    //// process modules
    ////// remove desktop sharing
    node = xpath.select1("//modules/module[@name=\'DeskShareModule\']", doc);
    node.setAttribute('showButton', 'false');
    //// remove PhoneModule button
    node = xpath.select1("//modules/module[@name=\'PhoneModule\']", doc);
    node.setAttribute('showButton', 'true');
    node.setAttribute('skipCheck', 'true');
    node.setAttribute('listenOnlyMode', 'false');
    //// remove VideoconfModule button
    node = xpath.select1("//modules/module[@name=\'VideoconfModule\']", doc);
    node.setAttribute('showButton', 'true');
    node.setAttribute('autoStart', 'true');
    node.setAttribute('skipCamSettingsCheck', 'true');
    //// remove layout menu
    node = xpath.select1("//modules/module[@name=\'LayoutModule\']", doc);
    node.setAttribute('enableEdit', 'false');

    return serializer.serializeToString(doc);
}

