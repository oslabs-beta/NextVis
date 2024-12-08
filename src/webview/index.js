import * as d3 from "d3";

const test = document.getElementById('chart');

const helloWorld = document.createElement('h1');
helloWorld.innerText = 'Middleware Dendrogram Tree';

test.appendChild(helloWorld);

const flare = {
  name: "app",
  children: [
    {
      name: "/home",
      children: [{ name: "/about",
        children:[{ name: ":path*", children: [{name: ":/a"}, {name: ":/b"}, {name: ":/c"}] }]
        }, 
    { name: "/order", children: [{ name: '/order/:id', children: [{ name: ':item'}]}, { name: ':item' }]}]
    },
    { name: "/dashboard",
      children:[{ name: "/dashboard/user", children: [{name: "/dashboard/user/settings"}, {name: "/dashboard/user/config"}] }]
      }
  ],
};

const createChart = (data) => {
  const width = 1000;
  const marginTop = 30;
  const marginRight = 30;
  const marginBottom = 30;
  const marginLeft = 40;

  // Rows are separated by dx pixels, columns by dy pixels. These names can be counter-intuitive
  // (dx is a height, and dy a width). This because the tree must be viewed with the root at the
  // “bottom”, in the data domain. The width of a column is based on the tree’s height.
  const root = d3.hierarchy(data);
  const dx = 100;
  const dy = (width - marginRight - marginLeft) / (1 + root.height);

    // Define the tree layout and the shape for links.
    const tree = d3.tree().nodeSize([dx, dy]);
    const diagonal = d3.linkHorizontal().x(d => d.y).y(d => d.x);
  
    // Create the SVG container, a layer for the links and a layer for the nodes.
    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", dx)
        .attr("viewBox", [-marginLeft, -marginTop, width, dx])
        .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif; user-select: none;");
  
    // styles the lines between nodes
    const gLink = svg.append("g")
        .attr("fill", "none")
        .attr("stroke", "#555")
        .attr("stroke-opacity", 0.5)
        .attr("stroke-width", 3);
  
    const gNode = svg.append("g")
        .attr("cursor", "pointer")
        .attr("pointer-events", "all");
  
    function update(event, source) {
      const duration = event?.altKey ? 2500 : 250; // hold the alt key to slow down the transition
      const nodes = root.descendants().reverse();
      const links = root.links();
  
      // Compute the new tree layout.
      tree(root);
  
      let left = root;
      let right = root;
      root.eachBefore(node => {
        if (node.x < left.x) left = node;
        if (node.x > right.x) right = node;
      });
  
      const height = right.x - left.x + marginTop + marginBottom;
  
      const transition = svg.transition()
          .duration(duration)
          .attr("height", height)
          .attr("viewBox", [-marginLeft, left.x - marginTop, width, height])
          .tween("resize", window.ResizeObserver ? null : () => () => svg.dispatch("toggle"));
  
      // Update the nodes…
      const node = gNode.selectAll("g")
        .data(nodes, d => d.id);
  
      // Enter any new nodes at the parent's previous position.
      const nodeEnter = node.enter().append("g")
          .attr("transform", d => `translate(${source.y0},${source.x0})`)
          .attr("fill-opacity", 0)
          .attr("stroke-opacity", 0)
          .on("click", (event, d) => {
            d.children = d.children ? null : d._children;
            update(event, d);
          });
  
      // styles the node as a circle
      // nodeEnter.append("circle")
      //     .attr("r", 10)
      //     .attr("width", 40)
      //     .attr("height", 20)
      //     .attr("fill", d => d._children ? "#555" : "#999")
      //     .attr("stroke-width", 10);

      // styles the node as a rectangle
      nodeEnter.append("rect")
        .attr("x", -20)
        .attr("y", -10)
        .attr("width", 40)
        .attr("height", 20)
        .attr("fill", d => d._children ? "red" : "blue")
        .attr("stroke-width", 10);
      
      // styles the text taken from data
      nodeEnter.append("text")
          .attr("dy", "0.31em")
          // changes x axis position of text depending on if node has children
          // .attr("x", d => d._children ? -6 : 6)
          // .attr("text-anchor", d => d._children ? "end" : "start")
          .attr("y", -20)
          .attr("x", -20)
          .attr("font-size", 15)
          .text(d => d.data.name)
          .attr("stroke-linejoin", "round")
          .attr("stroke-width", 3)
          .attr("stroke", "white")
          .attr("paint-order", "stroke");
  
      // Transition nodes to their new position.
      const nodeUpdate = node.merge(nodeEnter).transition(transition)
          .attr("transform", d => `translate(${d.y},${d.x})`)
          .attr("fill-opacity", 1)
          .attr("stroke-opacity", 1);
  
      // Transition exiting nodes to the parent's new position.
      const nodeExit = node.exit().transition(transition).remove()
          .attr("transform", d => `translate(${source.y},${source.x})`)
          .attr("fill-opacity", 0)
          .attr("stroke-opacity", 0);
  
      // Update the links…
      const link = gLink.selectAll("path")
        .data(links, d => d.target.id);
  
      // Enter any new links at the parent's previous position.
      const linkEnter = link.enter().append("path")
          .attr("d", d => {
            const o = {x: source.x0, y: source.y0};
            return diagonal({source: o, target: o});
          });
  
      // Transition links to their new position.
      link.merge(linkEnter).transition(transition)
          .attr("d", diagonal);
  
      // Transition exiting nodes to the parent's new position.
      link.exit().transition(transition).remove()
          .attr("d", d => {
            const o = {x: source.x, y: source.y};
            return diagonal({source: o, target: o});
          });
  
      // Stash the old positions for transition.
      root.eachBefore(d => {
        d.x0 = d.x;
        d.y0 = d.y;
      });
    }
  
    // Do the first update to the initial configuration of the tree — where a number of nodes
    // are open (arbitrarily selected as the root, plus nodes with 7 letters).
    root.x0 = dy / 2;
    root.y0 = 0;
    root.descendants().forEach((d, i) => {
      d.id = i;
      d._children = d.children;
      if (d.depth && d.data.name.length !== 7) d.children = null;
    });
  
    update(null, root);
  
    return svg.node();
}

const dendrogram = createChart(flare);

const chart = document.getElementById("chart");
chart.appendChild(dendrogram);