#!/usr/bin/env node

import { getPackages } from '@lerna/project';
import { Package } from '@lerna/package'
import fs from 'fs';
import graphviz from 'graphviz';
import yargs from 'yargs';

type Nodes = Record<string, Node>
type Edges = Record<string, graphviz.Edge>
type Node = {
	node: graphviz.Node
	edges: Edges
}

const argv = yargs
	.help()
	.alias('help', 'h')
	.version()
	.alias('version', 'v')
	.options({
		graphvizCommand: {
			alias: 'c',
			default: 'dot',
			description: 'Graphviz command to use.',
			type: 'string',
		},
		graphvizDirectory: {
			alias: 'd',
			description: 'Graphviz directory, if not in PATH.',
			type: 'string',
		},
		outputFormat: {
			alias: 'f',
			description: 'Outputs the given format. If not given, outputs plain DOT.',
			type: 'string',
		},
		outputPath: {
			alias: 'o',
			description: 'File to write into. If not given, outputs on stdout.',
			type: 'string',
		},
		rootPackage: {
			alias: 'p',
			description: 'Root package to start drawing map from. If not given, all packages are used.',
			type: 'string',
		},
		dependencyDepth: {
			alias: 'D',
			description: 'Depth to traverse dependencies.',
			type: 'number',
			default: 3,
		}
	}).argv;


getPackages().then((packages) => {
	const g = graphviz.digraph('G');

	g.use = argv.graphvizCommand as any;

	if (argv.graphvizDirectory) {
		g.setGraphVizPath(argv.graphvizDirectory);
	}

	const nodes: Nodes = {}
	const addNode = (name: string): graphviz.Node => {
		if (nodes[name]) return nodes[name].node
		const newNode = g.addNode(name)
		nodes[name] = { node: newNode, edges: {} }
		return newNode
	}
	const addEdge = (a: graphviz.Node, b: string) => {
		const existingEdge = nodes[a.id].edges[b] 
		if (existingEdge) return existingEdge
		const newEdge = g.addEdge(a, b)
		nodes[a.id].edges[b] = newEdge
		return newEdge
	}

	const getPackage = (name : string) => {
		return packages.find(pkg => {
			return pkg.name === name
		})
	}

	const renderDepsRecursively = ((pkg: Package, depth = 0) => {
		if (depth >= argv.dependencyDepth) return

		const node = addNode(pkg.name)
		if (depth === 0) {
			node.set('style', 'filled')
		}
		// console.log('recurse', pkg.name, depth)

		if (pkg.dependencies) {
			Object.keys(pkg.dependencies).forEach((depName) => {
				const p = getPackage(depName)
				if (p) {
					addEdge(node, depName)
					renderDepsRecursively(p, depth + 1)
				}
			});
		}
	})

	packages
		.filter(pkg => !argv.rootPackage || argv.rootPackage === pkg.name)
		.forEach((pkg) => {
			renderDepsRecursively(pkg, 0)
		});

	if (argv.outputFormat) {
		if (argv.outputPath) {
			g.output(argv.outputFormat, argv.outputPath);
		} else {
			g.output(argv.outputFormat, (data) => process.stdout.write(data));
		}
	} else {
		const data = g.to_dot();
		if (argv.outputPath) {
			fs.writeFile(argv.outputPath, data, (err) => {
				if (err) {
					console.error(err);
					process.exit(1);
				}
			});
		} else {
			console.log(data);
		}
	}
});
