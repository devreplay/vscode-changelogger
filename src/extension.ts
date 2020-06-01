// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Pattern } from 'devreplay';
import * as fs from 'fs';
import { join } from 'path';

import { makePatterns } from './makePatterns';
import { getDiff } from './diffprovider';
import { makeDiffObj } from './diffparser';
import { tryReadFile } from './file';
import { getFileSource } from './extensionmap';

export function activate(context: vscode.ExtensionContext) {
    vscode.workspace.onWillSaveTextDocument((event) => {
        const config = vscode.workspace.getConfiguration('changelogger');
        const isExecutable = config.get<boolean>('exec.save');
        if (isExecutable) {
            addChange();
        }
    });

    let disposable = vscode.commands.registerCommand('changelogger.addchange', addChange);
	context.subscriptions.push(disposable);
}

async function addChange() {
    // The code you place here will be executed every time your command is executed
    const diffs = await getDiff();
    const patterns = [];
    for (let diffIndex = 0; diffIndex < diffs.diffs.length; diffIndex++) {
        const diff = diffs.diffs[diffIndex];
        const filePath = diffs.changedFiles[diffIndex];
        const source = getFileSource(filePath);
        if (source === undefined) { continue; }

        const chunks = makeDiffObj(diff).filter(chunk => {return chunk.type == "changed"});
        for (const out of chunks.filter(chunk => {return chunk.type == "changed"})) {
            const pattern = await makePatterns(out.deleted.join("\n"),
                                               out.added.join("\n"), source);
            if (pattern !== undefined) {
                patterns.push(pattern);
            }
        }
    }

    const currentPatterns = readCurrentPattern()
    currentPatterns.push(...patterns);
    const devreplayPath = getDevReplayPath();
    if (devreplayPath === undefined) { return; }

    try {
        fs.writeFileSync(devreplayPath, JSON.stringify(currentPatterns, undefined, 2))
    } catch(err) {
        vscode.window.showErrorMessage(err.name);
    }
}

function readCurrentPattern(): Pattern[] {
    const devreplayPath = getDevReplayPath();
    if (devreplayPath === undefined) { return [] }
    let fileContents = undefined;
    try{
        fileContents = tryReadFile(devreplayPath);
    } catch {
        return [];
    }
    if (fileContents === undefined) {
        return []
    }
    return JSON.parse(fileContents) as Pattern[]
}

function getDevReplayPath() {
    if (vscode.workspace.workspaceFolders == undefined) { return undefined; }
    const root = vscode.workspace.workspaceFolders[0].uri.path;
    return join(root, 'devreplay.json');
}

// this method is called when your extension is deactivated
export function deactivate() {}

