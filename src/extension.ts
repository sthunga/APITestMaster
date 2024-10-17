import * as vscode from 'vscode';
import axios from 'axios';

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
        panel.webview.html = getWebviewContent();

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

function getWebviewContent() {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>API Tester</title>
          <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f4f4f4;
                margin: 0;
                padding: 10px;
            }

            h1 {
                color: #333;
                text-align: center;
                font-size: 18px;
                margin-bottom: 10px;
            }

            .container {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                padding: 10px;
                border-radius: 6px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                display: flex;
                flex-direction: column;
            }

            input, select, textarea {
                width: 100%;
                padding: 6px; 
                margin: 4px 0;
                border: 1px solid #ccc;
                border-radius: 4px;
                box-sizing: border-box;
                font-size: 12px;
            }

            .header-key, .header-value {
                width: calc(50% - 5px);
                padding: 6px;
                margin: 0 3px 4px 0;
                border: 1px solid #ccc;
                border-radius: 4px;
                box-sizing: border-box;
            }

            #headerContainer {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
            }

            .header-row {
                display: flex;
                align-items: center;
                margin-bottom: 4px;
            }

            .plus-icon {
                display: inline-block;
                width: 18px; 
                height: 18px;
                background-color: #007acc;
                border-radius: 3px;
                position: relative;
                cursor: pointer;
                margin-left: 5px;
                align-self: center;
            }

            .plus-icon:before,
            .plus-icon:after {
                content: '';
                position: absolute;
                background-color: white;
            }

            .plus-icon:before {
                width: 2px;
                height: 8px;
                top: 5px;
                left: 8px;
            }

            .plus-icon:after {
                width: 8px;
                height: 2px;
                top: 8px; 
                left: 5px;
            }

            button {
                background-color: #007acc;
                color: white;
                border: none;
                padding: 6px 10px;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.3s ease;
                font-size: 12px; 
                margin-top: 5px; 
            }

            button:hover {
                background-color: #005999;
            }

            pre {
                background-color: #f9f9f9;
                padding: 8px; 
                border-radius: 4px;
                border: 1px solid #e1e1e1;
                overflow: auto;
                white-space: pre-wrap;
                margin-top: 8px;
                font-size: 12px;
                max-height: 300px;
                overflow-y: auto;
            }

            /* Responsive Design */
            @media (max-width: 600px) {
                .container {
                    padding: 10px;
                }

                button {
                    width: 100%;
                }
            }
        </style>
      </head>
      <body>
          <div class="container">
              <h1>API Tester</h1>
              <input type="text" id="baseUrl" placeholder="Base URL" />
              <input type="text" id="endpoint" placeholder="Endpoint" />
              <select id="method">
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
              </select>
              <textarea id="data" placeholder="Request Data (JSON)" style="display: none;"></textarea>

              <h2>Headers</h2>
              <div id="headerContainer">
                  <div class="header-row">
                      <input type="text" class="header-key" placeholder="Header Key" />
                      <input type="text" class="header-value" placeholder="Header Value" />
                  </div>
                  <span id="addHeader" class="plus-icon" title="Add Header"></span>
              </div>
              
              <button id="send">Send Request</button>
              <button id="save">Save Request</button>
              <pre id="response"></pre>
              <div id="savedRequestsContainer"></div>
          </div>
          <script>
              const vscode = acquireVsCodeApi();
              document.addEventListener('DOMContentLoaded', () => {

                    const methodSelect = document.getElementById('method');
                    const dataTextarea = document.getElementById('data');
                    const responsePre = document.getElementById('response');
                    const headerContainer = document.getElementById('headerContainer');

                    // Function to toggle the visibility of the Request Data field
                    const toggleDataField = () => {
                        const method = methodSelect.value;
                        if (method === 'POST' || method === 'PUT') {
                            dataTextarea.style.display = 'block'; // Show for POST and PUT
                        } else {
                            dataTextarea.style.display = 'none'; // Hide for GET and DELETE
                            dataTextarea.value = ''; // Clear the textarea
                        }
                    };

                    methodSelect.addEventListener('change', toggleDataField);

                    // Initialize visibility based on the default selected method
                    toggleDataField();
                    
                    document.getElementById('addHeader').addEventListener('click', () => {
                        const headerRow = document.createElement('div');
                        headerRow.className = 'header-row';

                        const headerKeyInput = document.createElement('input');
                        headerKeyInput.className = 'header-key';
                        headerKeyInput.placeholder = 'Header Key';

                        const headerValueInput = document.createElement('input');
                        headerValueInput.className = 'header-value';
                        headerValueInput.placeholder = 'Header Value';

                        headerRow.appendChild(headerKeyInput);
                        headerRow.appendChild(headerValueInput);
                        headerContainer.insertBefore(headerRow, addHeader); // Insert new header row before the plus icon
                    });

                    document.getElementById('send').addEventListener('click', () => {
                        console.log('Send button clicked');
                        const baseUrl = document.getElementById('baseUrl').value;
                        const endpoint = document.getElementById('endpoint').value;
                        const method = document.getElementById('method').value;
                        const data = document.getElementById('data').value;

                        // Collect headers
                        const headers = {};
                        const headerKeys = document.querySelectorAll('.header-key');
                        const headerValues = document.querySelectorAll('.header-value');
                        headerKeys.forEach((key, index) => {
                            if (key.value) {
                                headers[key.value] = headerValues[index].value;
                            }
                        });
                        
                        // Validate JSON for POST and PUT requests
                        if ((method === 'POST' || method === 'PUT') && data) {
                            try {
                                JSON.parse(data); // Try to parse the JSON
                            } catch (error) {
                                responsePre.innerText = \`Error: Invalid JSON format. \${error.message}\`;
                                return; // Stop processing if JSON is invalid
                            }
                        }

                        vscode.postMessage({
                            command: 'sendRequest',
                            baseUrl,
                            endpoint,
                            method,
                            data: method === 'GET' || method === 'DELETE' ? null : JSON.parse(data),
                            headers
                        });
                    });
                    document.getElementById('save').addEventListener('click', () => {
                        const baseUrl = document.getElementById('baseUrl').value;
                        const endpoint = document.getElementById('endpoint').value;
                        const method = document.getElementById('method').value;
                        const data = document.getElementById('data').value;

                        // Collect headers
                        const headers = {};
                        const headerKeys = document.querySelectorAll('.header-key');
                        const headerValues = document.querySelectorAll('.header-value');
                        headerKeys.forEach((key, index) => {
                            if (key.value) {
                                headers[key.value] = headerValues[index].value;
                            }
                        });

                        vscode.postMessage({
                            command: 'saveRequest',
                            baseUrl,
                            endpoint,
                            method,
                            data: method === 'GET' || method === 'DELETE' ? null : data,
                            headers
                        });
                    });
                });
             window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'showResponse':
                            document.getElementById('response').innerText = JSON.stringify(message.response, null, 2);
                            break;
                        case 'showError':
                            document.getElementById('response').innerText = \`Error: \${ message.error } \`;
                            break;
                        case 'loadRequests':
                            const requestsContainer = document.getElementById('savedRequestsContainer');
                            requestsContainer.innerHTML  = '';
                            message.requests.forEach(request => {
                                const requestDiv = document.createElement('div');
                                requestDiv.innerText = \`\${request.method} \${request.baseUrl}\${request.endpoint} \${request.data} \${JSON.stringify(request.headers)}\`;
                                requestsContainer.appendChild(requestDiv);
                            });
                            break;
                    }
                });
          </script>
      </body>
      </html>`;
}
export function deactivate() { }
