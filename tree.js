NODE_WIDTH = 50;
NODE_HEIGHT = 50;
NODE_SEP = 3;

class TreeNode {
    constructor(value) {
        this.x = 0;
        this.y = 0;

        this.value = value;

        this.final = 0;
        this.modifier = 0;

        this.prevSibling = null;
        this.children = [];
    }

    visit(func) {
        func(this);
        for (let i = 0; i < this.children.length; i++) {
            this.children[i].visit(func);
        }
    }
}

class TreeRenderer {
    constructor(dataRoot, svgNode, width = 1000, height = 800) {
        // The root of the JavaScript object that represents the data
        // that we'll be rendering.
        this.dataRoot = dataRoot;

        // The SVG DOM node that the renderer will insert elements into.
        this.svgNode = svgNode;

        this.width = width;
        this.height = height;

        this.nodeRoot = this.prepareData(this.dataRoot, 0, null);

        this.firstPass(this.nodeRoot);
        this.secondPass(this.nodeRoot, 0);
        this.fixNodeConflicts(this.nodeRoot);
        this.shiftTreeIntoFrame();
    }

    /*
     * Build an intermediate form of the original data tree.  The nodes of
     * this new tree will be instances of the TreeNode class.
     */
    prepareData(node, level, prevSibling) {
        let treeNode = new TreeNode(node.value);
        treeNode.x = level;
        treeNode.prevSibling = prevSibling;

        for (let i = 0; i < node.children.length; i++) {
            treeNode.children.push(
                this.prepareData(
                    node.children[i],
                    level + 1,
                    i >= 1 ? treeNode.children[i - 1] : null
                )
            );
        }
        return treeNode;
    }

    /*
     * Assign initial position values to every node based on how many
     * prior siblings the current node has.
     */
    firstPass(node) {
        for (let i = 0; i < node.children.length; i++) {
            this.firstPass(node.children[i]);
        }

        if (node.prevSibling) {
            node.y = node.prevSibling.y + NODE_SEP;
        } else {
            node.y = 0;
        }

        if (node.children.length == 1) {
            node.modifier = node.y;
        } else if (node.children.length >= 2) {
            let minY = Infinity;
            let maxY = -minY;
            for (let i = 0; i < node.children.length; i++) {
                minY = Math.min(minY, node.children[i].y);
                maxY = Math.max(maxY, node.children[i].y);
            }
            node.modifier = node.y - (maxY - minY) / 2;
        }
    }

    /*
     * Adjust the position of children such that they end up centered
     * under their parent.
     */
    secondPass(node, modSum) {
        node.final = node.y + modSum;
        for (let i = 0; i < node.children.length; i++) {
            this.secondPass(node.children[i], node.modifier + modSum);
        }
    }

    /*
     * Work from the end of the tree back toward the beginning, fixing any
     * subtree overlap as we recurse through the tree.
    */
    fixNodeConflicts(node) {
        for (let i = 0; i < node.children.length; i++) {
            this.fixNodeConflicts(node.children[i]);
        }

        for (let i = 0; i < node.children.length - 1; i++) {
            // Get the bottom-most contour position of the current node
            let botContour = -Infinity;
            node.children[i].visit(
                node => (botContour = Math.max(botContour, node.final))
            );

            // Get the topmost contour position of the node underneath the current one
            let topContour = Infinity;
            node.children[i + 1].visit(
                node => (topContour = Math.min(topContour, node.final))
            );

            if (botContour >= topContour) {
                node.children[i + 1].visit(
                    node => (node.final += botContour - topContour + NODE_SEP)
                );
            }
        }
    }

    /*
     * Half of the tree will naturally fall outside the container once the
     * modifier values are applied.  Here we find the minimum Y value and
     * bump the entire tree down by that value to ensure that every node
     * is in frame.
     */
    shiftTreeIntoFrame() {
        let minY = Infinity;
        this.nodeRoot.visit(node => {
            minY = Math.min(minY, node.final);
        });

        this.nodeRoot.visit(node => {
            node.final += Math.abs(minY);
        });
    }

    /*
     * Return the width and height of the tree in layout units.
    */
    getDimensions() {
        let minWidth = Infinity;
        let maxWidth = -minWidth;

        let minHeight = Infinity;
        let maxHeight = -minHeight;

        this.nodeRoot.visit(node => {
            minWidth = Math.min(minWidth, node.x);
            maxWidth = Math.max(maxWidth, node.x);

            minHeight = Math.min(minHeight, node.final);
            maxHeight = Math.max(maxHeight, node.final);
        });

        return [maxWidth - minWidth, maxHeight - minHeight];
    }

    draw() {
        let [treeWidth, treeHeight] = this.getDimensions();
        let nodes = [this.nodeRoot];

        let levelWidth = this.width / (treeWidth + 1);
        let levelHeight = this.height / (treeHeight + 1);

        while (nodes.length) {
            let node = nodes.shift();
            nodes = nodes.concat(node.children);

            let parent = node.parent;

            let x1 = node.x * levelWidth;
            let y1 = node.final * levelHeight;

            let nodeElem = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "rect"
            );

            nodeElem.setAttribute("class", "tree-node");
            nodeElem.setAttribute("x", x1 - NODE_WIDTH / 2);
            nodeElem.setAttribute("y", y1 - NODE_HEIGHT / 2);
            nodeElem.setAttribute("width", NODE_WIDTH);
            nodeElem.setAttribute("height", NODE_HEIGHT);

            for (let i = 0; i < node.children.length; i++) {
                let x2 = node.children[i].x * levelWidth;
                let y2 = node.children[i].final * levelHeight;

                let pathElem = document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "path"
                );

                pathElem.setAttribute("d", `M${x1} ${y1} V${y2} H${x2}`);
                pathElem.setAttribute("class", "tree-line");
                this.svgNode.appendChild(pathElem);
            }

            let label = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "text"
            );

            label.setAttribute("class", "tree-label");
            label.setAttribute("x", x1);
            label.setAttribute("y", y1);
            label.textContent = node.value;

            this.svgNode.appendChild(nodeElem);
            this.svgNode.appendChild(label);
        }
    }
}
