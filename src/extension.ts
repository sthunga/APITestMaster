import * as vscode from 'vscode';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface ApiRequest {
    baseUrl: string;
    endpoint: string;
    method: string;
    data?: any;
    headers?: { [key: string]: string };
}

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('apitestmaster.testapi', async () => {
        const panel = vscode.window.createWebviewPanel(
            'apiTester', // Identifies the type of the webview
            'API Tester', // Title of the panel
            vscode.ViewColumn.One, // Editor column to show the new webview panel in
            { enableScripts: true, retainContextWhenHidden: true } // Webview options
        );
        // Set the HTML content for the webview
        panel.webview.html = getWebviewContent(context);

        // Load stored requests when the webview is opened
        const storedRequests = await context.globalState.get<ApiRequest[]>('savedRequests', []);
        panel.webview.postMessage({ command: 'loadRequests', requests: storedRequests });


        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'sendRequest':
                        await handleSendRequest(message, panel);
                        break;
                    case 'saveRequest':
                        await handleSaveRequest(message, context, panel);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

async function handleSendRequest(message: any, panel: vscode.WebviewPanel) {
    const { baseUrl, endpoint, method, data, headers } = message;
    try {
        const config: any = {
            method: method,
            url: `${baseUrl}${endpoint}`,
            headers: headers,
        };

        // Include data only for POST and PUT requests
        if (method === 'POST' || method === 'PUT') {
            config.data = data; // Only include if needed
        }

        const response = await axios(config);
        panel.webview.postMessage({ command: 'showResponse', response: response.data });
    } catch (error: any) {
        panel.webview.postMessage({ command: 'showError', error: error.message });
    }
}

async function handleSaveRequest(message: any, context: vscode.ExtensionContext, panel: vscode.WebviewPanel) {
    const newRequest: ApiRequest = {
        baseUrl: message.baseUrl,
        endpoint: message.endpoint,
        method: message.method,
        data: message.data,
        headers: message.headers
    };

    const storedRequests = (await context.globalState.get<ApiRequest[]>('savedRequests', [])) || [];
    storedRequests.push(newRequest);
    await context.globalState.update('savedRequests', storedRequests);
    panel.webview.postMessage({ command: 'loadRequests', requests: storedRequests });
}

function getWebviewContent(context: vscode.ExtensionContext) {
    const filePath = path.join(context.extensionPath, 'src/webview.html');
    return fs.readFileSync(filePath, 'utf8');
}
export function deactivate() { }
