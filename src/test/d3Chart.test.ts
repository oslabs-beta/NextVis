import createChart from '../webview/d3Chart';
// import * as d3 from 'd3';
// const createChart = require('../webview/d3Chart.js');
// const d3 = require('d3');

const mockFlareObject = {
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

// jest.mock('d3');

describe('D3 Tests', () => {
  test('creates an SVG element', () => {
    const chart = createChart(mockFlareObject);
    console.log(chart);
    const chartContainer = document.createElement('div');
    chartContainer.id = 'chart';

    // document.body.appendChild(chart);

    expect(chart).toBeDefined();
    
  });
});