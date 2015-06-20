function clamp(v, min, max) {
	return Math.max(min, Math.min(v, max));
}

function darken(color, amount) {
	var hsv = Please.HEX_to_HSV(color);
	hsv.v -= amount;
	return Please.HSV_to_HEX(hsv);
}

function pick(list, previous) {
	var result = list[Math.round(Math.random() * (list.length - 1))];
	if (typeof previous != "undefined") {
		while (pick == previous) {
			result = list[Math.round(Math.random() * (list.length - 1))];
		}
	}
	return result;
}

var VoronoiAnimation = {
	voronoi: new Voronoi(),
	sites: [],
	diagram: null,
	// margin for placement of random dots
	margin: 125,
	canvas: null,
	colors: [],
	bbox: {xl:0,xr:0,yt:0,yb:0},
	normalizeEventCoords: function(target,e) {
		// http://www.quirksmode.org/js/events_properties.html#position
		if (!e) {e=self.event;}
		var x = 0;
		var y = 0;
		if (e.pageX || e.pageY) {
			x = e.pageX;
			y = e.pageY;
		}
		else if (e.clientX || e.clientY) {
			x = e.clientX+document.body.scrollLeft+document.documentElement.scrollLeft;
			y = e.clientY+document.body.scrollTop+document.documentElement.scrollTop;
		}
		return {x:x-target.offsetLeft,y:y-target.offsetTop};
	},
	init: function() {
		var me = this;
		// canvi
		this.canvas = document.getElementById('voronoiCanvas');
		this.overlay = document.getElementById('overlayCanvas');
		this.lines = document.getElementById('linesCanvas');
		this.hidden = document.getElementById('hiddenCanvas');
		// update with size of canvas
		this.bbox.xr = this.canvas.width;
		this.bbox.yb = this.canvas.height;
		// colors
		var amount = 35;
		this.colors = [
			'#FF6138',
			'#FFFF9D',
			'#BEEB9F',
			'#79BD8F',
			'#00A388',
		];
		for(var i = 0; i < this.colors.length; i++) {
			console.log('color ('+i+'): ', this.colors[i]);
		}
		// mouse events
		$(this.canvas).on('mousemove', function(e) {
			if (!me.sites.length) 
				return;
			var site = me.sites[0];
			var mouse = me.normalizeEventCoords(me.canvas,e);
			site.x = mouse.x;
			site.y = mouse.y;
			//me.voronoi.recycle(me.diagram);
			me.diagram = me.voronoi.compute(me.sites, me.bbox);
			me.render();
		});
		var self = this;
		// add site at click position
		$(this.canvas).on('click', function(e) {
			e.preventDefault();
			self.addSite(e.pageX, e.pageY);
		});
		// generate random diagram
		this.randomSites(amount, true);
		// render it
		this.render();
		// animate sites
		setTimeout('VoronoiAnimation.animate()', 1000/31);
		setTimeout('VoronoiAnimation.draw()', 1000/31);
		// show byLines
		this.byLineEl = document.getElementById('byline');
		this.prevByLine = byLines[0];
		this.byLineEl.innerHTML = byLines[0];
		setInterval('VoronoiAnimation.ticker()', 5 * 1000);
	},
	ticker: function() {
		var byLine = pick(byLines, this.prevByLine);
		this.prevByLine = byline;
		var el = this.byLineEl;
		$(this.byLineEl).animate({
			opacity: 0
		}, 750, "easeOutQuad", function() {		
			el.innerHTML = byLine;
			$(el).animate({
				opacity: 1
			}, 1000, "easeInQuad");
		});
		
	},
	animate: function() {
		for (var i=1; i<this.sites.length; i++) {
			var site = this.sites[i];
			// detect and flip directions in x
			site.x += site.dx * site.vx;
			if (site.x < 0 || site.x > this.canvas.width) {
				site.dx = -site.dx;
			}
			site.x = Math.min(this.canvas.width, Math.max(0, site.x));
			// detect and flip directions in y
			site.y += site.dy * site.vy;
			if (site.y < 0 || site.y > this.canvas.height) {
				site.dy = -site.dy;
			}
			site.y = Math.min(this.canvas.height, Math.max(0, site.y));
			// persist changes
			this.sites[i] = site;
		}
		// recompute and render
		//this.voronoi.recycle(this.diagram);
		this.diagram = this.voronoi.compute(this.sites, this.bbox);
		this.render();
		setTimeout('VoronoiAnimation.animate()', 1000/60);
	},
	clearSites: function() {
		this.sites = [];
		// we want at least one site (tracking the mouse)
		this.addSite(0, 0);
		//this.voronoi.recycle(this.diagram);
		this.diagram = this.voronoi.compute(this.sites, this.bbox);
	},
	randomSites: function(n, clear) {
		if (clear)
			this.sites = [];
		var xo = this.margin;
		var dx = this.canvas.width-this.margin*2;
		var yo = this.margin;
		var dy = this.canvas.height-this.margin*2;
		for (var i=0; i < n; i++) {
			// random site within margin distance from canvas border
			this.addSite(Math.round(xo + Math.random()*dx), Math.round(yo + Math.random()*dy));
		}
		//this.voronoi.recycle(this.diagram);
		this.diagram = this.voronoi.compute(this.sites, this.bbox);
	},
	addSite: function(x,y) {
		this.sites.push({
			x: x,
			y: y,
			dx: (Math.random() > 0.5) ? -1 : 1,
			dy: (Math.random() > 0.5) ? -1 : 1,
			vx: clamp(Math.random(), 0.2, 1.0),
			vy: clamp(Math.random(), 0.2, 1.0),
			c: pick(this.colors)
		});
		//this.voronoi.recycle(this.diagram);
		this.diagram = this.voronoi.compute(this.sites, this.bbox);
	},
	renderEdges: function(ctx, color) {
		var edges = this.diagram.edges;
		var nEdges = edges.length;
		var v;
		if (nEdges) {
			var edge;
			ctx.beginPath();
			ctx.strokeStyle=color;
			while (nEdges--) {
				edge = edges[nEdges];
				v = edge.va;
				ctx.moveTo(v.x,v.y);
				v = edge.vb;
				ctx.lineTo(v.x,v.y);
			}
			ctx.stroke();
		}
	},
	renderSites: function(ctx, color) {
		var sites = this.sites;
		var nSites = sites.length;
		var site;
		ctx.beginPath();
		ctx.fillStyle = color;
		while (nSites--) {
			site = sites[nSites];
			ctx.rect(site.x-2/3,site.y-2/3,2,2);
		}
		ctx.fill();
	},
	renderCell: function(ctx, cell, color) {
		var halfedges = cell.halfedges;
		var nHalfedges = halfedges.length;
		if (nHalfedges > 2) {
			v = halfedges[0].getStartpoint();
			ctx.beginPath();
			ctx.moveTo(v.x,v.y);
			for (var iHalfedge=0; iHalfedge<nHalfedges; iHalfedge++) {
				v = halfedges[iHalfedge].getEndpoint();
				ctx.lineTo(v.x, v.y);
			}
			ctx.fillStyle = color;
			ctx.fill();
		}
	},
	renderCellOutline: function(ctx, cell, color, width) {
		if (typeof width != 'undefined') {
			var _width = ctx.lineWidth;
			ctx.lineWidth = width;
		}
		var halfedges = cell.halfedges;
		var nHalfedges = halfedges.length;
		if (nHalfedges > 2) {
			v = halfedges[0].getStartpoint();
			ctx.beginPath();
			ctx.moveTo(v.x,v.y);
			for (var iHalfedge=0; iHalfedge<nHalfedges; iHalfedge++) {
				v = halfedges[iHalfedge].getEndpoint();
				ctx.lineTo(v.x, v.y);
			}
			ctx.strokeStyle = color;
			ctx.stroke();
		}
		if (typeof width != 'undefined') {
			ctx.lineWidth = _width;
		}
	},
	clear: function(ctx, color, alpha) {
		if (typeof alpha == 'undefined') {
			alpha = 1;
		}
		ctx.globalAlpha = alpha;
		ctx.lineWidth = 1;
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
	},
	render: function() {
		var ctx = this.canvas.getContext('2d');
		this.clear(ctx, '#fff');
		var ovr = this.overlay.getContext('2d');
		ovr.globalCompositeOperation = 'destination-atop';
		this.clear(ovr, '#000', 0.95);
		var lns = this.lines.getContext('2d');
		this.clear(lns, '#000');
		var hdn = this.hidden.getContext('2d');
		this.clear(hdn, '#000');
		// voronoi 
		// render cells
		for(var i=0; i < this.diagram.cells.length; i++) {
			var cell = this.diagram.cells[i];
			if (cell.site.c == undefined) {
				cell.site.c =  this.colors[Math.round(Math.random() * this.colors.length)];
			}
			this.renderCell(ctx, cell, cell.site.c);
			//this.renderCellOutline(ctx, cell, cell.site.c, 0.5);
			this.renderCellOutline(hdn, cell, this.colors[4], 1);
		}
		// highlight cell under mouse
		var cell = this.diagram.cells[this.sites[0].voronoiId];
		// there is no guarantee a Voronoi cell will exist for any particular site
		if (cell) {
			this.renderCell(ovr, cell, '#fff');
			this.renderCellOutline(hdn, cell, '#fff', 2);
		}
		if (document.location.hash == '#debug') {
			document.getElementById('caption').style.display = 'none';
			// edges
			this.renderEdges(ctx, '#f0f');
			// draw sites
			this.renderSites(ctx, '#f0f');
		}
		// copy part over background to visible canvas		
		var data = hdn.getImageData(0, 124 - 12, this.hidden.width, 234 + 8);
		lns.putImageData(data, 0, 124 - 12);
	}
};

var byLines = [
	'Can be found on, <a href="https://github.com/brucejillis">Github</a>',
	'Can be found on, <a href="https://www.youtube.com/user/JillisterHove">YouTube</a>',
	'Is sometimes on, <a href="https://twitter.com/jillis">Twitter</a>',
	'Lives in, <a href="https://www.google.nl/maps/place/Arnhem/@52.0056159,5.8965987,12z/data=!3m1!4b1!4m2!3m1!1s0x47c7ba91ce9b2273:0x161c5ae0f973cad7?hl=en">Arnhem, the Netherlands</a>'
];

$(document).ready(function() {
		var canvas = document.getElementById('voronoiCanvas');
		var overlay = document.getElementById('overlayCanvas');
		var lines = document.getElementById('linesCanvas');
		var hidden = document.getElementById('hiddenCanvas');
		window.addEventListener('resize', resizeCanvas, false);
		function resizeCanvas() {
			// main canvas
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
			// overlay
			overlay.width = window.innerWidth;
			overlay.height = window.innerHeight;
			// lines
			lines.width = window.innerWidth;
			lines.height = window.innerHeight;
			// hidden
			hidden.width = window.innerWidth;
			hidden.height = window.innerHeight;
			VoronoiAnimation.init();
			// dont forget to remove the listener again, or the animation goes wild on resize
			window.removeEventListener('resize', resizeCanvas);
		}
		// resize canvi to browser size
		resizeCanvas();
});
