'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vsc_variables = require('../init/variables');
const fs = require("fs");

exports.onDidChangeConfiguration = (change) => {
	vsc_variables.settings = change.settings;

	let sqfGrammarFile;
	let fileBroken = false;
	try {
		sqfGrammarFile = require('../../../syntaxes/sqf.min.json');
	} catch(err) {
		fileBroken = true;
		sqfGrammarFile = require('../../../syntaxes/default.sqf.min.json');  // ReadOnly fallback
	}

	let patterns = [{ "include": "#vObject-statements" }];
	if (vsc_variables.settings.sqf.enableOFP) { patterns.push({ "include": "#OFP" }); }
	if (vsc_variables.settings.sqf.enableTOH) { patterns.push({ "include": "#TOH" }); }
	if (vsc_variables.settings.sqf.enableARMA) { patterns.push({ "include": "#ARMA" }); }
	if (vsc_variables.settings.sqf.enableARMA2) { patterns.push({ "include": "#ARMA2" }); }
	if (vsc_variables.settings.sqf.enableARMA3) { patterns.push({ "include": "#ARMA3" }); }
	if (vsc_variables.settings.sqf.enableCBA) { patterns.push({ "include": "#CBA" }); }
	if (vsc_variables.settings.sqf.enableACE3) { patterns.push({ "include": "#ACE3" }); }

	if (fileBroken || JSON.stringify(sqfGrammarFile.repository.statements.patterns) != JSON.stringify(patterns)) {
		sqfGrammarFile.repository.statements.patterns = patterns;
		let filePath = __dirname + "/../../../syntaxes/sqf.min.json";
		fs.truncate(filePath, 0, function() {
			fs.writeFile(filePath, JSON.stringify(sqfGrammarFile), function() {
				// Only offer restart once writing is done. Otherwise the sqf.min.json might stay empty / broken.
				vsc_variables.connection.sendNotification(
					'requestRestart',
					'SQF Language configuration updated. Please restart Visual Studio Code to apply the changes'
				);
			});
		})
	}

	// ToDo: Handle all upcomming directly in SqfScope once stable (obv. more performant than regex + loop)
	let sqfProject = vsc_variables.sqfProject;
	sqfProject.validationRegExPatterns = [];
	sqfProject.validationRegExPatterns.push({ 'cmd': 'getDammage', 'regex': /(\b)(getDammage)(\b)/g, 'msg': '[OFP] getDammage is deprecated use "damage" instead.' });
	sqfProject.validationRegExPatterns.push({ 'cmd': 'setDammage', 'regex': /(\b)(setDammage)(\b)/g, 'msg': '[OFP] setDammage is deprecated use "setDamage" instead.' });
	sqfProject.validationRegExPatterns.push({ 'cmd': 'BIS_fnc_MP', 'regex': /(\b)(BIS_fnc_MP)(\b)/g, 'msg': '[ArmA 3] BIS_fnc_MP is deprecated use the engine based commands "remoteExec" or "remoteExecCall" instead.' });
	sqfProject.validationRegExPatterns.push({ 'cmd': 'BIS_', 'regex': /(\b)(BIS_)([A-z0-9]*)(\s*)=/g, 'msg': 'The "BIS_" function should not be overwritten. "BIS_" is an reserved namespace for functions by Bohemia Interactive' });

	// Deprecated OFP -> ArmA
	if (vsc_variables.settings.sqf.enableARMA) {
		sqfProject.validationRegExPatterns.push({ 'cmd': 'exec', 'regex': /(\b)(exec)(\b)/g, 'msg': '[ArmA] exec is used for SQS files which are considered deprecated. Consider using execVM and SQF instead.' });
	}
	// ArmA 1 -> ArmA 3
	if (
		vsc_variables.settings.enableARMA &&
		vsc_variables.settings.sqf.enableARMA3
	) {
		sqfProject.validationRegExPatterns.push({ 'cmd': 'difficultyEnabled', 'regex': /(\b)(difficultyEnabled)(\b)/g, 'msg': '[ArmA 3] difficultyEnabled is deprecated. Use "difficultyOption" instead.' });
		sqfProject.validationRegExPatterns.push({ 'cmd': 'private', 'regex': /\b(private)\s*(\")/g, 'msg': '[ArmA 3] "private <string>" is deprecated. Consider using the private modifier directly at variable initialization i.e.: private _var = "value";' });
	}
	// Protect CBA namespace
	if (!vsc_variables.settings.sqf.enableCBA) {
		sqfProject.validationRegExPatterns.push({ 'cmd': 'CBA_', 'regex': /(\b)(CBA_)/g, 'msg': 'The "CBA_" namespace is reserved for the Community Based Addons. Please enable CBA commands in the settings.' });
	}
	// Protect ACE namespace
	if (!vsc_variables.settings.sqf.enableACE3) {
		sqfProject.validationRegExPatterns.push({ 'cmd': 'ACE_', 'regex': /(\b)(ACE_)/g, 'msg': 'The "ACE_" namespace is reserved. Please enable ACE commands in the settings.' });
	}
	vsc_variables.sqfProject.refreshSqfCommands();
	vsc_variables.documents.all().forEach((param) => sqfProject.getSqfFile(param.uri, true));
}
