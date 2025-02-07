import {createChart} from '../webview/d3Chart.js';

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


describe('D3 Tests', () => {
  test('creates an SVG element', () => {
    const chart = createChart(mockFlareObject);
    const chartContainer = document.createElement('div');
    chartContainer.id = 'chart';

    expect(chart).toBeDefined();
    
  });
});