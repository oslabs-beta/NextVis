/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(3));
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "nextFlow" is now active!');
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    const d3 = vscode.commands.registerCommand('nextFlow.start', () => {
        const panel = vscode.window.createWebviewPanel('nextFlow', 'NextFlow', vscode.ViewColumn.One, {
            enableScripts: true
        });
        const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, "dist", "webview.js")));
        panel.webview.html = getWebviewContent(scriptUri);
    });
    context.subscriptions.push(d3);
}
function getWebviewContent(uri) {
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Middleware Dendrogram</title>
      </head>
      <body>
        <h1>Middleware Tree</h1>
        <div>
          <input type="file" id="middlewareFile">
          <button type='submit' id="loadMiddleware">Load Middleware</button>
        </div>
        <div id="chart"></div>
        <script src="${uri}"></script>
      </body>
      </html>`;
}
// This method is called when your extension is deactivated
function deactivate() { }
// // ------
// // The module 'vscode' contains the VS Code extensibility API
// // Import the module and reference it with the alias vscode in your code below
// import * as vscode from 'vscode';
// // import * as fs from 'fs';
// import * as path from 'path';
// // This method is called when your extension is activated
// // Your extension is activated the very first time the command is executed
// export function activate(context: vscode.ExtensionContext) {
// 	// Use the console to output diagnostic information (console.log) and errors (console.error)
// 	// This line of code will only be executed once when your extension is activated
// 	console.log('Congratulations, your extension "nextFlow" is now active!');
// 	// The command has been defined in the package.json file
// 	// Now provide the implementation of the command with registerCommand
// 	// The commandId parameter must match the command field in package.json
// 	const disposable = vscode.commands.registerCommand('nextFlow.helloWorld', () => {
// 		// The code you place here will be executed every time your command is executed
// 		// Display a message box to the user
// 		vscode.window.showInformationMessage('Hello VS Code!');
// 	});
// 	const catCodingExample = vscode.commands.registerCommand('catCoding.start', () => {
// 		const panel = vscode.window.createWebviewPanel(
// 			'catCoding',
// 			'Cat Coding',
// 			vscode.ViewColumn.One,
// 			{enableScripts: true,
// 				localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'src'))]
// 			}
// 		);
// 		const webviewJsPath = vscode.Uri.file(
// 			path.join(context.extensionPath, 'src/webview', 'index.js')
// 		  );
// 		  const webviewJsUri = panel.webview.asWebviewUri(webviewJsPath);
// 		  panel.webview.html = getWebviewContent(webviewJsUri);
// 	});
// 	const visualizer = vscode.commands.registerCommand('nextFlow.start', () => {
// 		const panel = vscode.window.createWebviewPanel(
// 			'nextFlow',
// 			'Next Flow',
// 			vscode.ViewColumn.One,
// 			{}
// 		);
// 		// panel.webview.html = getWebviewContent();
// 	});
// 	context.subscriptions.push(catCodingExample);
// }
// 	function getWebviewContent(webviewJsUri: vscode.Uri): string {
// 		return `<!DOCTYPE html>
// 	<html lang="en">
// 	<head>
// 		<meta charset="UTF-8">
// 		<meta name="viewport" content="width=device-width, initial-scale=1.0">
// 		<meta http-equiv="Content-Security-Policy" content="default-src * self blob: data: gap:; style-src * self 'unsafe-inline' blob: data: gap:; script-src * 'self' 'unsafe-eval' 'unsafe-inline' blob: data: gap:; object-src * 'self' blob: data: gap:; img-src * self 'unsafe-inline' blob: data: gap:; connect-src self * 'unsafe-inline' blob: data: gap:; frame-src * self blob: data: gap:;">
// 		<title>Next Flow Visualizer</title>
// 	</head>
// 	<body>
// 		<div id="title"></div>
// 		<div id="chart"></div>
// 		<p>Testing Webview!</p>
// 		<!-- D3.js Import -->
// 		<script type="module"></script>
// 		<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>	
// 		<!-- Local JavaScript File -->
// 		<script src="${webviewJsUri}"></script>
// 	</body>
// 	</html>`;
// //   return `<!DOCTYPE html>
// // <div id="title"></div>
// // <div id="chart"></div>
// // <script type="module">
// // import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
// // const test = document.getElementById('title');
// // const helloWorld = document.createElement('h1');
// // helloWorld.innerText = 'Middleware Dendrogram';
// // test.appendChild(helloWorld);
// // const flare = {
// //   name: "app",
// //   children: [
// //     {
// //       name: "/home",
// //       children: [{ name: "/about",
// //         children:[{ name: ":path*", children: [{name: ":/a"}, {name: ":/b"}, {name: ":/c"}] }]
// //         }, 
// //     { name: "/order", children: [{ name: '/order/:id', children: [{ name: ':item'}]}, { name: ':item' }]}]
// //     },
// //     { name: "/dashboard",
// //       children:[{ name: "/dashboard/user", children: [{name: "/dashboard/user/settings"}, {name: "/dashboard/user/config"}] }]
// //       }
// //   ],
// // };
// // const createChart = (data) => {
// //   const width = 1000;
// //   const marginTop = 30;
// //   const marginRight = 30;
// //   const marginBottom = 30;
// //   const marginLeft = 40;
// //   // Rows are separated by dx pixels, columns by dy pixels. These names can be counter-intuitive
// //   // (dx is a height, and dy a width). This because the tree must be viewed with the root at the
// //   // “bottom”, in the data domain. The width of a column is based on the tree’s height.
// //   const root = d3.hierarchy(data);
// //   const dx = 100;
// //   const dy = (width - marginRight - marginLeft) / (1 + root.height);
// //     // Define the tree layout and the shape for links.
// //     const tree = d3.tree().nodeSize([dx, dy]);
// //     const diagonal = d3.linkHorizontal().x(d => d.y).y(d => d.x);
// //     // Create the SVG container, a layer for the links and a layer for the nodes.
// //     const svg = d3.create("svg")
// //         .attr("width", width)
// //         .attr("height", dx)
// //         .attr("viewBox", [-marginLeft, -marginTop, width, dx])
// //         .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif; user-select: none;");
// //     // styles the lines between nodes
// //     const gLink = svg.append("g")
// //         .attr("fill", "none")
// //         .attr("stroke", "#555")
// //         .attr("stroke-opacity", 0.5)
// //         .attr("stroke-width", 3);
// //     const gNode = svg.append("g")
// //         .attr("cursor", "pointer")
// //         .attr("pointer-events", "all");
// //     function update(event, source) {
// //       const duration = event?.altKey ? 2500 : 250; // hold the alt key to slow down the transition
// //       const nodes = root.descendants().reverse();
// //       const links = root.links();
// //       // Compute the new tree layout.
// //       tree(root);
// //       let left = root;
// //       let right = root;
// //       root.eachBefore(node => {
// //         if (node.x < left.x) left = node;
// //         if (node.x > right.x) right = node;
// //       });
// //       const height = right.x - left.x + marginTop + marginBottom;
// //       const transition = svg.transition()
// //           .duration(duration)
// //           .attr("height", height)
// //           .attr("viewBox", [-marginLeft, left.x - marginTop, width, height])
// //           .tween("resize", window.ResizeObserver ? null : () => () => svg.dispatch("toggle"));
// //       // Update the nodes…
// //       const node = gNode.selectAll("g")
// //         .data(nodes, d => d.id);
// //       // Enter any new nodes at the parent's previous position.
// //       const nodeEnter = node.enter().append("g")
// //           .attr("transform", d => \`translate(\${source.y0},\${source.x0})\`)
// //           .attr("fill-opacity", 0)
// //           .attr("stroke-opacity", 0)
// //           .on("click", (event, d) => {
// //             d.children = d.children ? null : d._children;
// //             update(event, d);
// //           });
// //       // styles the node as a circle
// //       // nodeEnter.append("circle")
// //       //     .attr("r", 10)
// //       //     .attr("width", 40)
// //       //     .attr("height", 20)
// //       //     .attr("fill", d => d._children ? "#555" : "#999")
// //       //     .attr("stroke-width", 10);
// //       // styles the node as a rectangle
// //       nodeEnter.append("rect")
// //         .attr("x", -20)
// //         .attr("y", -10)
// //         .attr("width", 40)
// //         .attr("height", 20)
// //         .attr("fill", d => d._children ? "red" : "blue")
// //         .attr("stroke-width", 10);
// //       // styles the text taken from data
// //       nodeEnter.append("text")
// //           .attr("dy", "0.31em")
// //           // changes x axis position of text depending on if node has children
// //           // .attr("x", d => d._children ? -6 : 6)
// //           // .attr("text-anchor", d => d._children ? "end" : "start")
// //           .attr("y", -20)
// //           .attr("x", -20)
// //           .attr("font-size", 15)
// //           .text(d => d.data.name)
// //           .attr("stroke-linejoin", "round")
// //           .attr("stroke-width", 3)
// //           .attr("stroke", "white")
// //           .attr("paint-order", "stroke");
// //       // Transition nodes to their new position.
// //       const nodeUpdate = node.merge(nodeEnter).transition(transition)
// //           .attr("transform", d => \`translate(\${d.y},\${d.x})\`)
// //           .attr("fill-opacity", 1)
// //           .attr("stroke-opacity", 1);
// //       // Transition exiting nodes to the parent's new position.
// //       const nodeExit = node.exit().transition(transition).remove()
// //           .attr("transform", d => \`translate(\${source.y},\${source.x})\`)
// //           .attr("fill-opacity", 0)
// //           .attr("stroke-opacity", 0);
// //       // Update the links…
// //       const link = gLink.selectAll("path")
// //         .data(links, d => d.target.id);
// //       // Enter any new links at the parent's previous position.
// //       const linkEnter = link.enter().append("path")
// //           .attr("d", d => {
// //             const o = {x: source.x0, y: source.y0};
// //             return diagonal({source: o, target: o});
// //           });
// //       // Transition links to their new position.
// //       link.merge(linkEnter).transition(transition)
// //           .attr("d", diagonal);
// //       // Transition exiting nodes to the parent's new position.
// //       link.exit().transition(transition).remove()
// //           .attr("d", d => {
// //             const o = {x: source.x, y: source.y};
// //             return diagonal({source: o, target: o});
// //           });
// //       // Stash the old positions for transition.
// //       root.eachBefore(d => {
// //         d.x0 = d.x;
// //         d.y0 = d.y;
// //       });
// //     }
// //     // Do the first update to the initial configuration of the tree — where a number of nodes
// //     // are open (arbitrarily selected as the root, plus nodes with 7 letters).
// //     root.x0 = dy / 2;
// //     root.y0 = 0;
// //     root.descendants().forEach((d, i) => {
// //       d.id = i;
// //       d._children = d.children;
// //       if (d.depth && d.data.name.length !== 7) d.children = null;
// //     });
// //     update(null, root);
// //     return svg.node();
// // }
// // const dendrogram = createChart(flare);
// // const chart = document.getElementById("chart");
// // chart.appendChild(dendrogram);
// // </script>`;
// }
// // This method is called when your extension is deactivated
// export function deactivate() {}


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */,
/* 3 */
/***/ ((module) => {

module.exports = require("path");

/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map