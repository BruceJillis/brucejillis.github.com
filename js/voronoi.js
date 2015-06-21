function clamp(v, min, max) {
	return Math.max(min, Math.min(v, max));
}

function pick(list, previous) {
	var p = Math.round(Math.random() * (list.length - 1));
	var result = list[p];
	if (typeof previous != "undefined") {
		while (result == previous) {
			p = Math.round(Math.random() * (list.length - 1));
			result = list[p];
		}
	}
	return result;
}

var VoronoiAnimation = {
	voronoi: new Voronoi(),
	sites: [],
	diagram: null,
	// margin for placement of random dots
	/** @const */ margin: 125,
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
		// mark us as running
		this.running = true;
		// store ref to this for use in closures
		var self = this;
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
			'#00A388'
		];
		// mouse events
		self.trackmouse = -1;
		$(this.canvas).on('mousemove', function(e) {
			self.trackmouse = self.sites.length-1;
			var site = self.sites[self.trackmouse];
			var mouse = self.normalizeEventCoords(self.canvas,e);
			site.x = mouse.x;
			site.vx = 0;
			site.y = mouse.y;
			site.vy = 0;
		});
		$(this.canvas).on('mouseout', function(e) {
			self.trackmouse = -1;
		});
		// generate random diagram
		this.randomSites(amount, true);
		// render it
		this.render();
		// animate sites
		setTimeout('VoronoiAnimation.animate()', 0);
		// show byLines
		this.byLineEl = document.getElementById('byline');
		var byLine = pick(byLines);
		this.prevByLine = byLine;
		this.byLineEl.innerHTML = byLine;
		setInterval('VoronoiAnimation.ticker()', 5 * 1000);
	},
	stop: function() {
		this.running = false;
		$(this.canvas).remove('mousemove', 'mouseout');
	},
	ticker: function() {
		var byLine = pick(byLines, this.prevByLine);
		this.prevByLine = byLine;
		var el = this.byLineEl;
		$(this.byLineEl).animate({
			opacity: 0
		}, 750, "easeOutQuad", function() {		
			el.innerHTML = byLine;
			$(el).animate({
				opacity: 1
			}, 250, "easeInQuad");
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
		this.diagram = this.voronoi.compute(this.sites, this.bbox);
		this.render();
		// if we are still running, do another loop of animation
		if (this.running) {	
			setTimeout('VoronoiAnimation.animate()', 1000/60);
		}
	},
	clearSites: function() {
		this.sites = [];
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
		ctx.strokeStyle = color;
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
			ctx.strokeStyle = color;
			ctx.fill();
		}
	},
	renderCellOutline: function(ctx, cell, color, width) {
		if (typeof width != 'undefined') {
			var _width = ctx.lineWidth;
			ctx.lineWidth = width;
		}
		ctx.strokeStyle = color;
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
		ctx.strokeStyle = '#000';
		ctx.fillStyle = '#000';
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
	},
	render: function() {
		var ctx = this.canvas.getContext('2d');
		this.clear(ctx, '#fff');
		var ovr = this.overlay.getContext('2d');
		ovr.globalCompositeOperation = 'destination-atop';
		this.clear(ovr, '#000', 0.95);
		var lns = this.lines.getContext('2d');
		this.clear(lns, '#fff');
		var hdn = this.hidden.getContext('2d');
		this.clear(hdn, '#000');
		// voronoi 
		// highlight cell under mouse
		if (this.trackmouse != -1) {
			var cell = this.diagram.cells[this.sites[this.trackmouse].voronoiId];
			// there is no guarantee a Voronoi cell will exist for any particular site
			if (cell) {
				this.renderCell(ovr, cell, '#fff');
			}
		}
		// render cells
		for(var i=0; i < this.diagram.cells.length; i++) {
			var cell = this.diagram.cells[i];
			if (cell.site.c == undefined) {
				cell.site.c =  this.colors[Math.round(Math.random() * this.colors.length)];
			}
			this.renderCellOutline(hdn, cell, this.colors[4], 1);
			if (this.trackmouse != -1 && this.sites[this.trackmouse].voronoiId == i) 
				continue;
			this.renderCell(ctx, cell, cell.site.c);
			this.renderCellOutline(ctx, cell, cell.site.c, 0.5);
		}
		// debug
		if (document.location.hash == '#debug') {
			document.getElementById('caption').style.display = 'none';
			// edges
			this.renderEdges(hdn, '#f0f');
			this.renderEdges(ctx, '#f0f');
			// draw sites
			this.renderSites(hdn, '#f0f');
			this.renderSites(ctx, '#f0f');
		}
		// copy part over background to visible canvas		
		var obj = document.getElementById('background');
		var data = hdn.getImageData(0, (obj.offsetTop - 12), obj.offsetWidth + 32, obj.offsetHeight + 8);
		lns.putImageData(data, 1, (obj.offsetTop - 12));
	}
};

var byLines = [
	'Can be found on, <a href="https://github.com/brucejillis">Github</a>',
	'Can be found on, <a href="https://www.youtube.com/user/JillisterHove">YouTube</a>',
	'Is available for web development work, <a href="mailto://j.terhove (AT) gmail (DOT) com">j.terhove (AT) gmail (DOT) com</a>.',
	'Can sometimes be found on, <a href="https://twitter.com/jillis">Twitter</a>',
	'Lives in, <a href="https://www.google.nl/maps/place/Arnhem/@52.0056159,5.8965987,12z/data=!3m1!4b1!4m2!3m1!1s0x47c7ba91ce9b2273:0x161c5ae0f973cad7?hl=en">Arnhem, the Netherlands</a>',
	'Can be contacted via, <a href="mailto://j.terhove (AT) gmail (DOT) com">j.terhove (AT) gmail (DOT) com</a>.',
	'Once made a mario-like game where you are the bad guy, <a href="https://dl.dropboxusercontent.com/u/29254286/index.html">Before the Hero Arrives</a>.',
	'Once made a top-down sailing simulation game, <a href="https://dl.dropboxusercontent.com/u/29254286/bgj2.html">Eco2</a>.',
	'Once made some stuff in flash, <a href="https://dl.dropboxusercontent.com/u/29254286/juicy.html">games and juicyness</a>, <a href="https://dl.dropboxusercontent.com/u/29254286/FlxMinimap.html">flixel minimap</a>.',
	'Once tried to make a game in unity, <a href="https://dl.dropboxusercontent.com/u/29254286/ionan/ionan.html">v2</a> < <a href="https://dl.dropboxusercontent.com/u/29254286/planetwide/Web.html">v1</a> < <a href="https://dl.dropboxusercontent.com/u/29254286/escape/escape.html">v0.1</a>.',
	'Recorded some UI experiments in unity, <a href="https://dl.dropboxusercontent.com/u/29254286/v09.gif">as a GIF</a> and on <a href="https://www.youtube.com/watch?v=fTjL-R37vvU&ab_channel=JillisterHove">YouTube</a>.',
	'Wrote libraries for language detection in, <a href="https://github.com/BruceJillis/PHP-Language-Detection">PHP</a> and <a href="https://github.com/BruceJillis/LanguageIdentification">python</a>.',
	'Added some stuff to minecraft, <a href="https://www.youtube.com/watch?v=s2y-adFJeKQ&ab_channel=JillisterHove">Gaze Detecting Enderman Heads</a>.',
	'Really enjoyed playing minecraft but wanted more to explore, <a href="https://www.youtube.com/watch?v=a1yORDZsHb8&ab_channel=JillisterHove">Prototype Dungeon Generator</a> + <a href="https://www.youtube.com/watch?v=55QhLcPvWS8&ab_channel=JillisterHove">more work</a>.',
	'Enjoys participating in gamejam\'s, <a href="https://www.youtube.com/watch?v=Ns208w9rua0&ab_channel=JillisterHove">Modjam: Mailbox Mod</a>.',
	'Once tried to create a programming language, <a href="https://github.com/BruceJillis/fp.py">fp</a>.'
];

$(document).ready(function() {
		var canvas = document.getElementById('voronoiCanvas');
		var overlay = document.getElementById('overlayCanvas');
		var lines = document.getElementById('linesCanvas');
		var hidden = document.getElementById('hiddenCanvas');
		window.addEventListener('resize', resizeCanvas, false);
		function stopAndResizeCanvas() {
			VoronoiAnimation.stop();
			resizeCanvas();
		}
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
			window.removeEventListener('resize', stopAndResizeCanvas);
		}
		// resize canvi to browser size
		resizeCanvas();
		// listen for clicks
		$(document).on("click", 'h2 > a', function(e) {
			var href = $(this).attr('href');
			ga('send', 'event', 'click', href);
		});
});
