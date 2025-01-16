import * as d3 from 'd3';

let showMatchers = false;

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
  const diagonal = d3
    .linkHorizontal()
    .x((d) => d.y)
    .y((d) => d.x);

  // Create the SVG container, a layer for the links and a layer for the nodes.
  const svg = d3
    .create('svg')
    .attr('width', width)
    .attr('height', dx)
    .attr('viewBox', [-marginLeft, -marginTop, width, dx])
    .attr(
      'style',
      'max-width: 100%; height: auto; font: 10px sans-serif; user-select: none;'
    );

  // styles the lines between nodes
  const gLink = svg
    .append('g')
    .attr('fill', 'none')
    .attr('stroke', '#555')
    .attr('stroke-opacity', 0.5)
    .attr('stroke-width', 3);

  const gNode = svg
    .append('g')
    .attr('cursor', 'pointer')
    .attr('pointer-events', 'all');

  function update(event, source) {
    const duration = event?.altKey ? 2500 : 250; // hold the alt key to slow down the transition
    const nodes = root.descendants().reverse();
    const links = root.links();

    // Compute the new tree layout.
    tree(root);

    let left = root;
    let right = root;
    root.eachBefore((node) => {
      if (node.x < left.x) left = node;
      if (node.x > right.x) right = node;
    });

    const height = right.x - left.x + marginTop + marginBottom;

    const transition = svg
      .transition()
      .duration(duration)
      .attr('height', height)
      .attr('viewBox', [-marginLeft, left.x - marginTop, width, height])
      .tween(
        'resize',
        window.ResizeObserver ? null : () => () => svg.dispatch('toggle')
      );

    // Update the nodes…
    const node = gNode.selectAll('g').data(nodes, (d) => d.id);

    // Enter any new nodes at the parent's previous position.
    const nodeEnter = node
      .enter()
      .append('g')
      .attr('transform', (d) => `translate(${source.y0},${source.x0})`)
      .attr('fill-opacity', 0)
      .attr('stroke-opacity', 0)
      .on('mouseover', function (event, d) {
        let g = d3.select(this);

        if (!showMatchers) return;

        const matcher = d.data.matcher
          ? d.data.matcher.join(', ')
          : 'No matcher in this middleware';

        let info = g
          .append('text')
          .classed('info', true)
          .attr('x', 20)
          .attr('y', 10)
          .attr('stroke', 'white')
          .text(matcher); // parse from script --> matcher or conditional
      })
      .on('mouseout', function () {
        d3.select(this).select('text.info').remove();
      })
      .on('click', (event, d) => {
        d.children = d.children ? null : d._children;
        update(event, d);
      });

    // styles the node as a circle
    nodeEnter
      .append('circle')
      .attr('r', 10)
      .attr('width', 40)
      .attr('height', 20)
      .attr('fill', (d) => (d._children ? '#982933' : '#4B8F8C'))
      .attr('stroke-width', 10);

    // styles the node as a rectangle
    // nodeEnter.append("rect")
    //   .attr("x", -20)
    //   .attr("y", -10)
    //   .attr("width", 40)
    //   .attr("height", 20)
    //   .attr("fill", d => d._children ? "red" : "blue")
    //   .attr("stroke-width", 10);

    // styles the text taken from data
    nodeEnter
      .append('text')
      .attr('dy', '0.31em')
      // changes x axis position of text depending on if node has children
      // .attr("x", d => d._children ? -6 : 6)
      // .attr("text-anchor", d => d._children ? "end" : "start")
      .attr('y', -20)
      .attr('x', -20)
      .attr('font-size', 15)
      .text((d) => d.data.name)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-width', 3)
      .attr('stroke', 'white')
      .attr('paint-order', 'stroke');

    // Transition nodes to their new position.
    const nodeUpdate = node
      .merge(nodeEnter)
      .transition(transition)
      .attr('transform', (d) => `translate(${d.y},${d.x})`)
      .attr('fill-opacity', 1)
      .attr('stroke-opacity', 1);

    // Transition exiting nodes to the parent's new position.
    const nodeExit = node
      .exit()
      .transition(transition)
      .remove()
      .attr('transform', (d) => `translate(${source.y},${source.x})`)
      .attr('fill-opacity', 0)
      .attr('stroke-opacity', 0);

    // Update the links…
    const link = gLink.selectAll('path').data(links, (d) => d.target.id);

    // Enter any new links at the parent's previous position.
    const linkEnter = link
      .enter()
      .append('path')
      .attr('d', (d) => {
        const o = { x: source.x0, y: source.y0 };
        return diagonal({ source: o, target: o });
      });

    // Transition links to their new position.
    link.merge(linkEnter).transition(transition).attr('d', diagonal);

    // Transition exiting nodes to the parent's new position.
    link
      .exit()
      .transition(transition)
      .remove()
      .attr('d', (d) => {
        const o = { x: source.x, y: source.y };
        return diagonal({ source: o, target: o });
      });

    // Stash the old positions for transition.
    root.eachBefore((d) => {
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
};

const vscode = acquireVsCodeApi();

const container = document.body;

const title = document.createElement('h1');
title.textContent = 'Middleware Tree';

const fileInput = document.createElement('div');
fileInput.id = 'middlewareFile';
// fileInput.type = "file";
// fileInput.innerText = "Select middleware file";

const loadButton = document.createElement('button');
loadButton.type = 'button';
loadButton.id = 'loadMiddleware';
loadButton.textContent = 'Load Middleware Tree';
// loadButton.style.padding = '5px';
loadButton.style.margin = '10px 0px 0px 0px'; // spacing
loadButton.style.borderRadius = '10px'; // border radius

const metricsButton = document.createElement('button');
metricsButton.type = 'button';
metricsButton.id = 'openMetrics';
metricsButton.textContent = 'Open Metrics Panel';
metricsButton.style.margin = '10px 0px 0px 0px';
metricsButton.style.borderRadius = '10px';

const matcherLabel = document.createElement('label');
matcherLabel.setAttribute('for', 'showMatchers');
matcherLabel.textContent = 'Show matchers';

const matcherCheckbox = document.createElement('input');
matcherCheckbox.type = 'checkbox';
matcherCheckbox.id = 'showMatchers';

const fileContainer = document.createElement('div');
fileContainer.appendChild(fileInput);
fileContainer.appendChild(loadButton);

const chartContainer = document.createElement('div');
chartContainer.id = 'chart';
chartContainer.style.padding = '20px 0px 0px'; // spacing

const optionsContainer = document.createElement('div');
optionsContainer.appendChild(matcherCheckbox);
optionsContainer.appendChild(matcherLabel);

container.appendChild(title);
container.appendChild(fileContainer);
container.appendChild(metricsButton);
container.appendChild(chartContainer);
container.appendChild(optionsContainer);

loadButton.addEventListener('click', () => {
  console.log('Load Middleware button clicked');

  vscode.postMessage({
    command: 'pickFile',
    text: 'Picking file...',
  });
});

metricsButton.addEventListener('click', () => {
  console.log('Open Metrics button clicked');

  vscode.postMessage({
    command: 'openMetricsPanel',
  });
});

window.addEventListener('message', (event) => {
  const message = event.data; // The JSON data our extension sent

  function getRandomColor() {
    // random color on title
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  switch (message.command) {
    case 'filePicked':
      document.getElementById(
        'middlewareFile'
      ).textContent = `Selected file: ${message.filePath}`;
      // document.getElementById("middlewareFile").style.color = getRandomColor();
      if (message.flare) {
        const chart = document.getElementById('chart');
        chart.innerHTML = '';

        const dendrogram = createChart(message.flare);
        console.log('message.flare: ', message.flare);

        chart.appendChild(dendrogram);
        title.textContent = `Middleware Tree for ${message.compName}`;
        // title.style.color = getRandomColor(); // line 240
      } else {
        vscode.postMessage({
          command: 'alert',
          text: 'Please select a middleware file',
        });
      }
  }
});

document.getElementById('showMatchers').addEventListener('change', (event) => {
  showMatchers = event.target.checked;
  updateChart();
});
