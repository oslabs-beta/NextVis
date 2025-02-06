import * as vscode from 'vscode';
import { activate } from '../extension';

let registeredCommands: { [key: string]: Function } = {};

// mock the test with jest
jest.mock('vscode', () => ({
	ExtensionContext: jest.fn(),
	window: {		
	showInformationMessage: jest.fn(),
	  createWebviewPanel: jest.fn().mockReturnValue({
		webview: {
		  html: '',
          asWebviewUri: jest.fn().mockReturnValue('mockUri'),
		  onDidReceiveMessage: jest.fn(),
		  postMessage: jest.fn()
		}
	  }),
	  showOpenDialog: jest.fn(),
	  showErrorMessage: jest.fn()
	},
	commands: {
	  registerCommand: jest.fn((command, callback) => {
		// Store the callback so we can call it in tests
		registeredCommands[command] = callback;
		return { dispose: jest.fn() };
	  }),
	  executeCommand: jest.fn((command) => {
        if (registeredCommands[command]) {
            return registeredCommands[command](); // Call the stored function
        }}),
	},
	ViewColumn: {
	  One: 1,
	  Two: 2
	},
	Uri: {
		file: jest.fn((filePath) => ({ fsPath: filePath }))
	},
	  showOpenDialog: jest.fn()
  }),{ virtual: true });



describe ('NextFlow Extension Test', () => {
	let context : vscode.ExtensionContext;
	let asWebviewUriMock: jest.Mock;

	beforeEach (()=> {
		jest.clearAllMocks();
		registeredCommands = {};

		asWebviewUriMock = jest.fn().mockReturnValue('mockUri');

		(vscode.window.createWebviewPanel as jest.Mock).mockReturnValue({
			webview: {
				html: '',
				asWebviewUri: asWebviewUriMock, // Mocking asWebviewUri function
				onDidReceiveMessage: jest.fn(),
				postMessage: jest.fn(),
			},
		});

		context = {
			subscriptions: [],
			extensionPath: '/fake/path',
			asAbsolutePath: jest.fn(p => p),
		}as unknown as vscode.ExtensionContext;
		});

		describe('activate', () => {
			test('should register the nextFlow.start command',  () => {
			  activate(context);
			//   console.log(context);
			  // Check that the 'nextFlow.start' command is registered
			  expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
				'nextFlow.start',
				expect.any(Function)
			  );
			});

			test('should create nextFlow webview panels when command is executed', ()=> {
				activate(context);

				const commandCallback = registeredCommands['nextFlow.start'];
				expect(commandCallback).toBeDefined();

				if (commandCallback) {
					commandCallback(); // Trigger the callback
				  }
				
				
				expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);

				expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
					'nextFlow',
					'NextFlow',
					vscode.ViewColumn.One,
					expect.objectContaining({enableScripts: true, retainContextWhenHidden: true})
				);
			});
			test('should create metric webview panels when command is executed', async ()=> {
				context.subscriptions.push(
					vscode.commands.registerCommand('openMetricsPanel', () => {
					  vscode.window.createWebviewPanel(
						'metrics',
						'NextFlow Metrics',
						vscode.ViewColumn.Two,
						{ enableScripts: true, retainContextWhenHidden: true }
					  );
					})
				  );

				activate(context);
				// console.log(context.subscriptions[1].dispose);
				
				// Mock createWebviewPanel
				const createWebviewPanelSpy = jest.spyOn(vscode.window, 'createWebviewPanel');

				// Execute the command
				await vscode.commands.executeCommand('openMetricsPanel');
			
				expect(createWebviewPanelSpy).toHaveBeenCalledTimes(1);
				expect(createWebviewPanelSpy).toHaveBeenCalledWith(
					'metrics',
					'NextFlow Metrics',
					vscode.ViewColumn.Two,
					expect.objectContaining({ enableScripts: true, retainContextWhenHidden: true })
				);
					
					// test('should call correct file path', () => {
					// 	expect(asWebviewUriMock.mock.calls.length).toBe(1)
					// });
				
			});	
	});
});