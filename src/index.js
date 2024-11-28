const test = document.getElementById('demo');

const helloWorld = document.createElement('h1');
helloWorld.innerText = 'Hello World!';

test.appendChild(helloWorld);






// import * as d3 from "d3";



// const svg = d3
//   .create("svg")
//   .attr("viewBox", [(-dy * padding) / 2, x0 - dx, width, height])
//   .attr("width", width)
//   .attr("height", height)
//   .attr("style", "max-width: 100%; height: auto; height: intrinsic;")
//   .attr("font-family", "sans-serif")
//   .attr("font-size", 10);

// svg
//   .append("g")
//   .attr("fill", "none")
//   .attr("stroke", stroke)
//   .attr("stroke-opacity", strokeOpacity)
//   .attr("stroke-linecap", strokeLinecap)
//   .attr("stroke-linejoin", strokeLinejoin)
//   .attr("stroke-width", strokeWidth)
//   .selectAll("path")
//   .data(root.links())
//   .join("path")
//   .attr(
//     "d",
//     d3
//       .link(curve)
//       .x((d) => d.y)
//       .y((d) => d.x)
//   );

// const flare = {
//   name: "app",
//   children: [
//     {
//       name: "/home",
//       children: [{ name: "/about",
//         children:[{ name: ":path*", children: [{name: ":/a"}, {name: ":/b"}, {name: ":/c"}] }]
//         }, 
//     { name: "/order", children: [{ name: '/order/:id', children: [{ name: ':item'}]}, { name: ':item' }]}]
//     },
//     { name: "/dashboard",
//       children:[{ name: "/dashboard/user", children: [{name: "/dashboard/user/settings"}, {name: "/dashboard/user/config"}] }]
//       }
//   ],
// };


// // https://observablehq.com/@d3/tree
// function Tree(
//   data,
//   {
//     // data is either tabular (array of objects) or hierarchy (nested objects)
//     path, // as an alternative to id and parentId, returns an array identifier, imputing internal nodes
//     id = Array.isArray(data) ? (d) => d.id : null, // if tabular data, given a d in data, returns a unique identifier (string)
//     parentId = Array.isArray(data) ? (d) => d.parentId : null, // if tabular data, given a node d, returns its parent’s identifier
//     children, // if hierarchical data, given a d in data, returns its children
//     tree = d3.tree, // layout algorithm (typically d3.tree or d3.cluster)
//     sort, // how to sort nodes prior to layout (e.g., (a, b) => d3.descending(a.height, b.height))
//     label, // given a node d, returns the display name
//     title, // given a node d, returns its hover text
//     link, // given a node d, its link (if any)
//     linkTarget = "_blank", // the target attribute for links (if any)
//     width = 640, // outer width, in pixels
//     height, // outer height, in pixels
//     r = 15, // radius of nodes
//     padding = 1, // horizontal padding for first and last column
//     fill = "#999", // fill for nodes
//     fillOpacity, // fill opacity for nodes
//     stroke = "#555", // stroke for links
//     strokeWidth = 1.5, // stroke width for links
//     strokeOpacity = 0.4, // stroke opacity for links
//     strokeLinejoin, // stroke line join for links
//     strokeLinecap, // stroke line cap for links
//     halo = "#fff", // color of label halo
//     haloWidth = 3, // padding around the labels
//     curve = d3.curveBumpX, // curve for the link
//     dyNode = 10 // vertical height of node
//   } = {}
// ) {
//   // If id and parentId options are specified, or the path option, use d3.stratify
//   // to convert tabular data to a hierarchy; otherwise we assume that the data is
//   // specified as an object {children} with nested objects (a.k.a. the “flare.json”
//   // format), and use d3.hierarchy.
//   const root =
//     path != null
//       ? d3.stratify().path(path)(data)
//       : id != null || parentId != null
//       ? d3.stratify().id(id).parentId(parentId)(data)
//       : d3.hierarchy(data, children);

//   // Sort the nodes.
//   if (sort != null) root.sort(sort);

//   // Compute labels and titles.
//   const descendants = root.descendants();
//   const L = label == null ? null : descendants.map((d) => label(d.data, d));

//   // Compute the layout.
//   const dx = dyNode; // vertical height of node
//   const dy = (width / (root.height + padding)) * 0.9; // reduced width by 90%, default is without *.9
//   tree().nodeSize([dx, dy])(root);

//   // Center the tree.
//   let x0 = Infinity;
//   let x1 = -x0;
//   root.each((d) => {
//     if (d.x > x1) x1 = d.x;
//     if (d.x < x0) x0 = d.x;
//   });

//   // Compute the default height.
//   if (height === undefined) height = x1 - x0 + dx * 2;

//   // Use the required curve
//   if (typeof curve !== "function") throw new Error(`Unsupported curve`);

//   const svg = d3
//     .create("svg")
//     .attr("viewBox", [(-dy * padding) / 2, x0 - dx, width, height])
//     .attr("width", width)
//     .attr("height", height)
//     .attr("style", "max-width: 100%; height: auto; height: intrinsic;")
//     .attr("font-family", "sans-serif")
//     .attr("font-size", 10);

//   svg
//     .append("g")
//     .attr("fill", "none")
//     .attr("stroke", stroke)
//     .attr("stroke-opacity", strokeOpacity)
//     .attr("stroke-linecap", strokeLinecap)
//     .attr("stroke-linejoin", strokeLinejoin)
//     .attr("stroke-width", strokeWidth)
//     .selectAll("path")
//     .data(root.links())
//     .join("path")
//     .attr(
//       "d",
//       d3
//         .link(curve)
//         .x((d) => d.y)
//         .y((d) => d.x)
//     );

//   const node = svg
//     .append("g")
//     .selectAll("a")
//     .data(root.descendants())
//     .join("a")
//     .attr("xlink:href", link == null ? null : (d) => link(d.data, d))
//     .attr("target", link == null ? null : linkTarget)
//     .attr("transform", (d) => `translate(${d.y},${d.x})`);

//   node
//     .append("circle")
//     .attr("fill", (d) => (d.children ? stroke : fill))
//     .attr("r", r)

//   // Interactivity    
//   node
//     .on('click', () => {
//     console.log('Node clicked')
    
//     let zoom = d3.zoom()
//       .on('zoom', handleZoom);
    
//     function handleZoom(e) {
//       console.log('handling zoom');
//       d3.select('svg r')
//         .attr('transform', e.transform);
//     }
  
//     function initZoom() {
//       console.log('init zooming')
//       d3.select('svg g')
//         .call(d3.zoom());
//     }
  
    
//     // function update() {
//     //   console.log('updating');
//     //   d3.select('svg g')
//     //     .selectAll('circle')
//     //     .data(data)
//     //     .join('circle')
//     //     .attr('cx', function(d) { return d.x; })
//     //     .attr('cy', function(d) { return d.y; })
//     //     .attr('r', 3);
//     // }

//     const gNode = svg.append("g")
//       .attr("cursor", "pointer")
//       .attr("pointer-events", "all");
  
//     // Trying to make nodes collapsible
//     function update(event, source) {
//       const duration = event?.altKey ? 2500 : 250; // hold the alt key to slow down the transition
//       const nodes = root.descendants().reverse();
//       const links = root.links();
  
//       // Compute the new tree layout.
//       tree(root);
  
//       let left = root;
//       let right = root;
//       root.eachBefore(node => {
//         if (node.x < left.x) left = node;
//         if (node.x > right.x) right = node;
//       });
  
//       const transition = svg.transition()
//             .duration(duration)
//             .attr("height", height)
//             // .attr("viewBox", [-marginLeft, left.x - marginTop, width, height])
//             .tween("resize", window.ResizeObserver ? null : () => () => svg.dispatch("toggle"));
  
//       // Update the nodes…
//       const node = gNode.selectAll("g")
//         .data(nodes, d => d.id);
  
//       // Enter any new nodes at the parent's previous position.
//       const nodeEnter = node.enter().append("g")
//           // .attr("transform", d => `translate(${source.y0},${source.x0})`)
//           .attr("fill-opacity", 0)
//           .attr("stroke-opacity", 0)
//           .on("click", (event, d) => {
//             d.children = d.children ? null : d._children;
//             update(event, d);
//           });
  
//       nodeEnter.append("circle")
//           .attr("r", 2.5)
//           .attr("fill", d => d._children ? "#555" : "#999")
//           .attr("stroke-width", 10);
  
//       nodeEnter.append("text")
//           .attr("dy", "0.31em")
//           .attr("x", d => d._children ? -6 : 6)
//           .attr("text-anchor", d => d._children ? "end" : "start")
//           .text(d => d.data.name)
//           .attr("stroke-linejoin", "round")
//           .attr("stroke-width", 3)
//           .attr("stroke", "white")
//           .attr("paint-order", "stroke");
  
//       // Transition nodes to their new position.
//       const nodeUpdate = node.merge(nodeEnter).transition(transition)
//           .attr("transform", d => `translate(${d.y},${d.x})`)
//           .attr("fill-opacity", 1)
//           .attr("stroke-opacity", 1);
  
//       // Transition exiting nodes to the parent's new position.
//       const nodeExit = node.exit().transition(transition).remove()
//           .attr("transform", d => `translate(${source.y},${source.x})`)
//           .attr("fill-opacity", 0)
//           .attr("stroke-opacity", 0);
//     };
//     // initZoom();
//     update();
    
//   })


  

//   if (title != null) node.append("title").text((d) => title(d.data, d));

//   if (L)
//     node
//       .append("text")
//       .attr("dy", "0.32em")
//       .attr("x", (d) => (d.children ? -6 : 6))
//       .attr("text-anchor", (d) => (d.children ? "end" : "start"))
//       .attr("paint-order", "stroke")
//       .attr("stroke", halo)
//       .attr("stroke-width", haloWidth)
//       .text((d, i) => L[i]);
      
//   return svg.node();
// };


// // JSON data that tree takes in, where our extension could input data about middleware routes
//     flare = {
//       name: "app",
//       children: [
//         {
//           name: "/home",
//           children: [{ name: "/about",
//             children:[{ name: ":path*", children: [{name: ":/a"}, {name: ":/b"}, {name: ":/c"}] }]
//            }, 
//         { name: "/order", children: [{ name: '/order/:id', children: [{ name: ':item'}]}, { name: ':item' }]}]
//         },
//         { name: "/dashboard",
//           children:[{ name: "/dashboard/user", children: [{name: "/dashboard/user/settings"}, {name: "/dashboard/user/config"}] }]
//          }
//       ],
//     };
  

//     // below uses Tree method defined above, which takes parameters as dict
//     // to configure most visuals, it alos has defaults defined, eg width.
    
//     chart = Tree(flare, {    // The JSON data
//       label: (d) => d.name,  // Name on the node
//       width: 1000,            // width of chart
//       dyNode: 50,            // height of node
//     });
    
//     // add chart to the DOM
    // document.getElementById("demo").appendChild(chart);
  
