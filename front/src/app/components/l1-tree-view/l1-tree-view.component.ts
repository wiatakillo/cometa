import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Select, Store } from '@ngxs/store';
import { CustomSelectors } from '@others/custom-selectors';
import { ApiService } from '@services/api.service';
import { FeaturesState } from '@store/features.state';
import * as d3 from 'd3';
import { debounceTime, Observable } from 'rxjs';

@Component({
  selector: 'cometa-l1-tree-view',
  templateUrl: './l1-tree-view.component.html',
  styleUrls: ['./l1-tree-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class L1TreeViewComponent implements OnInit{

  data = {}
  viewingData = {}
  @Select(FeaturesState.GetNewSelectionFolders) currentRoute$: Observable<ReturnType<typeof FeaturesState.GetNewSelectionFolders>>;

  svgs = {
    domain: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M80-120v-720h400v160h400v560H80Zm80-80h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm160 480h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm160 480h320v-400H480v80h80v80h-80v80h80v80h-80v80Zm160-240v-80h80v80h-80Zm0 160v-80h80v80h-80Z"/></svg>`,
    folder:`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0z" fill="none"/><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
    home:`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0z" fill="none"/><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
    `,
    description:`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M8 16h8v2H8zm0-4h8v2H8zm6-10H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>`,
    ethernet:`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M7.77 6.76L6.23 5.48.82 12l5.41 6.52 1.54-1.28L3.42 12l4.35-5.24zM7 13h2v-2H7v2zm10-2h-2v2h2v-2zm-6 2h2v-2h-2v2zm6.77-7.52l-1.54 1.28L20.58 12l-4.35 5.24 1.54 1.28L23.18 12l-5.41-6.52z"/></svg>`,
  }

  widthChecker(text) {
    const p = document.createElement("p");
    p.style.fontSize = "16px";
    p.style.position = "absolute";
    p.style.opacity = "0";
    p.innerHTML = text;
    document.body.append(p);
    const textWidth = p.clientWidth;
    document.body.removeChild(p);
    return textWidth;
}

  constructor( private _store: Store, private _api: ApiService, private _router: Router ) {}

  findEmbededObject(data: any, obj: any) {
    // if data type is feature, add feature id as suffix in name
    // if data type is not feature, just truncate name
    if (data.type === 'feature' && !data.name.includes(" - " + data.id)) {
      data.name = this.truncateString(data.name, 25) + ` - ${data.id}`;
    } else {
      data.name = this.truncateString(data.name, 25);
    }

    let found = null;
    if ( data.id == obj.id && data.name == obj.name && data.type == obj.type ) {
      found = data;
    }
    if (data.children) {
      data.children.forEach(child => {
        const value = this.findEmbededObject(child, obj)
        if (value) found = value;
      });
    }
    return found;
  }

  truncateString(input: string, maxLength: number): string {
    const ellipsis = '...';

    if (input.length <= maxLength) {
      return input;
    }

    const prefixLength = Math.floor((maxLength - ellipsis.length) / 2);
    const suffixLength = Math.ceil((maxLength - ellipsis.length) / 2);

    const prefix = input.slice(0, prefixLength);
    const suffix = input.slice(-suffixLength);

    return prefix + ellipsis + suffix;
  }

  dataFromCurrentRoute(currentRouteArray) {
    // get the last object from the route
    const elem: Folder = currentRouteArray.slice(-1).pop()
    if (!elem) {
      return this.data;
    }

    const object = {
      id: elem.folder_id,
      name: elem.name,
      type: elem.type == undefined ? 'folder' : elem.type
    }
    return this.findEmbededObject(this.data, object);
  }

  draw() {

    // Obtén el elemento con el ID 'tree-view'
    const treeViewElement = d3.select("#tree-view").node();

    let boundries = {width: 0, height: 0};

    // Check if the element is present in the DOM
    if (treeViewElement) {
        // Get the bounding rectangle only if the element is present
        boundries = treeViewElement.getBoundingClientRect();
    } else {
        console.log('El elemento con ID "tree-view" no está presente en el DOM.');
    }

    // viewer width and height
    const width = boundries.width;
    const height = boundries.height;

    const imageSize = 20;
    const textSpace = 15;

    const margins = {top: 0, right: 120, bottom: 0, left: 30};
    const dx = 30; // line height
    const dy = width / 4;

    const tree = d3.tree().nodeSize([dx, dy]);
    const diagonal = d3.linkHorizontal().x(d => {
        let appendText = 0;
        if (d.data) appendText = this.widthChecker(d.data.name) + textSpace + 5
        return d.y + appendText
    }).y(d => d.x + 1);

    let root = d3.hierarchy(this.viewingData);
    root.x0 = dy / 2;
    root.y0 = 0;
    root.descendants().forEach((d, i) => {
      d.id = i;
    })

    const zoom = d3.zoom().scaleExtent([1, 10])
                          .on('zoom', (event) => {
                            svg.attr("transform", event.transform)
                          })

    const parent = d3.select("#tree-view").append("svg")
                                  .attr("width", "100%")
                                  .attr("height", "99%")
                                  .style("font", "10px sans-serif")
                                  .style("user-select", "none")
                                  .call(zoom)
                                  .on("dblclick.zoom", null);
    const svg = parent.append("g");

    const gLink = svg.append("g")
                    .attr("fill", "none")
                    .attr("stroke", "#555")
                    .attr("stroke-opacity", 0.4)
                    .attr("stroke-width", 1.5);
    const gNode = svg.append("g")
                    .attr("cursor", "pointer")
                    .attr("pointer-events", "all");
    
    const collapse = (d) => {
      if (d.children) {
        d._children = d.children;
        d._children.forEach(collapse);
        d.children = null;
      }
    }

    const expand = (d) => {
      if (d._children) {
        d.children = d._children;
        d.children.forEach(expand);
        d._children = null;
      }
    }

    const toggle = (d) => {
      if (d._children) {
        d.children = d._children;
        d._children = null;
      } else if (d.children) {
        d._children = d.children;
        d.children = null;
      }
    }

    function centerNode(source) {
      const t = d3.zoomTransform(parent.node());
      const boundries = d3.selectAll('g').filter(d => d ? d.id == source.id : false).node().getBBox();
      let x = -source.y0;
      let y = -source.x0;
      x = x * t.k + (width / 2) - margins.left - (boundries.width / 2);
      if (source.children) {
        x = x - (dy / 2);
      }
      y = y * t.k - (dx * 2); // move upwards a little bit....
      d3.select('svg').transition().duration(250).call( zoom.transform, d3.zoomIdentity.translate(x,y).scale(t.k) );
    }

    const update = source => {
      const duration = 250;
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
  
      const height = right.x - left.x + margins.top + margins.bottom;
      const transition = parent.transition()
                            .duration(duration)
                            .attr("viewBox", [-margins.left, left.x - margins.top, width, height ])
                            .tween("resize", window.ResizeObserver ? null : () => () => svg.dispatch("toggle"));
      
      // Update the nodes…
      const node = gNode.selectAll("g")
                        .data(nodes, d => d.id);
      let feature: Feature

      // Enter any new nodes at the parent's previous position.
      const nodeEnter = node.enter().append("g")
                                    .attr("transform", d => `translate(${source.y0},${source.x0})`)
                                    .attr("fill-opacity", 0)
                                    .attr("stroke-opacity", 0)
                                    .on("click", (event, d) => {
                                      toggle(d);
                                      update(d);
                                      centerNode(d)
                                    })
                                    .on("dblclick", (event, d) => {

                                      if (d.data.type == "feature") {
                                        this._router.navigate(['/from/tree-view/', d.data.id])
                                      }
                                    })

      nodeEnter.append((d) => {
        const icon_element = document.createElement("div");
        switch (d.data.type) {
          case "department":
            icon_element.innerHTML = this.svgs.domain;
            break;
          case "folder":
            icon_element.innerHTML = this.svgs.folder;
            break;
          case "home":
            icon_element.innerHTML = this.svgs.home;
            break;
          case "feature":
            icon_element.innerHTML = this.svgs.description;
            break;
          case "variables":
            icon_element.innerHTML = this.svgs.ethernet;
            break;
          case "variable":
            icon_element.innerHTML = this.svgs.ethernet;
            break;
          default:
            icon_element.innerHTML = "<svg></svg>";
            break;
        }
        return icon_element.firstChild;
      })
                .attr("width", imageSize)
                .attr("height", imageSize)
                // // Old
                // // .style("font-family", 'Material Icons')
                .attr("x", `-${imageSize/2}`)
                .attr("y", `-${imageSize/2}`)
                // .attr('font-size', "20px")
                .attr('fill', d =>  d.data.type === "feature" && d.data.depends_on_others ? 'gray' : 'black')
                .attr("class", d => d.data.type != "feature" && !d.children && !d._children ? 'disabled' : '')
                // .text(d => {
                //   switch (d.data.type) {
                //     case "department":
                //       return ;
                //     case "folder":
                //       return ;
                //     case "home":
                //       return "home";
                //     case "feature":
                //       return "description icon";
                //     case "variables":
                //     case "variable":
                //       return "settings_ethernet";
                //   }
                // })
      
      nodeEnter.append("text")
                .attr("dy", "0.40em")
                .attr("x", textSpace)
                .attr("text-anchor", "start")
                .attr("class", d => `node-text node-text-${d.data.type}`)
                .text(d => d.data.name)
  
      nodeEnter.append("circle")
                .attr("r", d => d.parent ? 5 : 0)
                .attr("fill", "gray")
                .attr("transform", `translate(${-textSpace - 5}, 1)`)
  
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
          .attr("d", d => {
              const target = {
                  x: d.target.x,
                  y: d.target.y - 15
              }
              return diagonal({source: d.source, target: target})
          });
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
    root.children.forEach(collapse);
    update(root);
    centerNode(root);
  }

  async ngOnInit() {

    this.data = await this._api.getTreeView().toPromise();

    this.currentRoute$.pipe(debounceTime(100)).subscribe(d => {
      const data = this.dataFromCurrentRoute(d);
      if (data) {
        this.viewingData = data;
        d3.select("#tree-view").select("svg").remove();
        this.draw();
      }
    })
  }


}
