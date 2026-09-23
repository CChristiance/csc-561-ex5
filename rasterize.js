/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://raw.githubusercontent.com/NCSUCGClassPrivate/exercise5/async/triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://raw.githubusercontent.com/NCSUCGClassPrivate/exercise5/async/ellipsoids.json"; // ellipsoids file loc
var Eye = new vec4.fromValues(0.5,0.5,-0.5,1.0); // default eye position in world space

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffer; // this contains vertex coordinates in triples
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize = 0; // the number of indices in the triangle buffer
var vertexPositionAttrib; // where to put position for vertex shader


// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
// uses async get with older callback API
// should one day use newer promise API
function getJSONFile(url,descr) {
    
    var returnValue = String.null; // the default return value

    if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
        console.error("getJSONFile: parameter not a string");
    else { // else we have good params
        
        var loadDone = false; // whether the load attempt is done
        
        // when get fails
        function getFailed(evt) {
            loadDone = true; 
            console.error(descr + " failed to load.");
        } // end when get fails

        // when get aborted
        function getAborted(evt) { 
            loadDone = true; 
            console.error(descr + " was aborted by user.");
        } // end when get aborted

        // when get times out
        function getTimedOut(evt) {
            loadDone = true; 
            console.error(descr + " took too long to load.");
        } // end when get times out

        // when get loads
        function getLoaded(evt) {
            loadDone = true; 
            console.log(descr + " loaded.");
            returnValue = JSON.parse(httpReq.responseText);
        } // end when get times out

        // set up http request object
        var httpReq = new XMLHttpRequest(); // a new http request
        // httpReq.timeout = 2000; // wait 2 secs for async result then timeout
        httpReq.addEventListener("error", getFailed);
        httpReq.addEventListener("abort", getAborted);
        httpReq.addEventListener("timeout", getTimedOut);
        httpReq.addEventListener("load", getLoaded);

        // issue async get request
        httpReq.open("GET",url,false); // init the request asynchronously
        httpReq.send(null); // send the request
        
        // wait for http request to complete
        var numChecks = 0;
        while (!loadDone && (numChecks < 25)) {
            console.log("loadDone: "+loadDone+", numChecks: "+numChecks);
            window.setTimeout(function(){},100);
            numChecks++;
        } // end while
    } // end if good params
    
    return(returnValue);
} // end get json file

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read triangles in, load them into webgl buffers
function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");

    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var coordArray = []; // 1D array of vertex coords for WebGL
        var indexArray = []; // 1D array of vertex indices for WebGL
        var vtxBufferSize = 0; // the number of vertices in the vertex buffer
        var vtxToAdd = []; // vtx coords to add to the coord array
        var indexOffset = vec3.create(); // the index offset for the current set
        var triToAdd = vec3.create(); // tri indices to add to the index array
        
        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {
            vec3.set(indexOffset,vtxBufferSize,vtxBufferSize,vtxBufferSize); // update vertex offset
            
            // set up the vertex coord array
            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++) {
                vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert];
                coordArray.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]);
            } // end for vertices in set
            
            // set up the triangle index array, adjusting indices across sets
            for (whichSetTri=0; whichSetTri<inputTriangles[whichSet].triangles.length; whichSetTri++) {
                vec3.add(triToAdd,indexOffset,inputTriangles[whichSet].triangles[whichSetTri]);
                indexArray.push(triToAdd[0],triToAdd[1],triToAdd[2]);
            } // end for triangles in set

            vtxBufferSize += inputTriangles[whichSet].vertices.length; // total number of vertices
            triBufferSize += inputTriangles[whichSet].triangles.length; // total number of tris
        } // end for each triangle set 
        triBufferSize *= 3; // now total number of indices

        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW); // coords to that buffer
        
        // send the triangle indices to webGL
        triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indexArray),gl.STATIC_DRAW); // indices to that buffer

    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float;
        uniform vec3 color;

        void main(void) {
            gl_FragColor = vec4(color, 1.0); // all fragments are white
        }
    `;
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        uniform mat4 view;
        uniform mat4 projection;

        void main(void)
        {
            gl_Position = projection * view * vec4(vertexPosition, 1.0);
            // gl_Position = projection * view * model * vec4(vertexPosition, 1.0);

            // gl_Position = vec4(vertexPosition, 1.0);
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition"); 
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array
                return shaderProgram;
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
        return null;
    } // end catch
} // end setup shaders

// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed

    // triangle buffer: activate and render
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffer); // activate
    gl.drawElements(gl.TRIANGLES,triBufferSize,gl.UNSIGNED_SHORT,0); // render
} // end render triangles


/* MAIN -- HERE is where execution begins after window load */

function main() {
    var context = document.getElementById("myWebGLCanvas");
    var w = context.width; // as set in html
    var h = context.height;  // as set in html;
  
    setupWebGL(); // set up the webGL environment
    loadTriangles(); // load in the triangles from tri file
    var shaderProgram = setupShaders(); // setup the webGL shaders
    renderTriangles(); // draw the triangles using webGL

    const viewLoc = gl.getUniformLocation(shaderProgram, "view");
    const projectionLoc = gl.getUniformLocation(shaderProgram, "projection");
    const colorLoc = gl.getUniformLocation(shaderProgram, "color");

    // setup camera
    var cameraPos = vec3.fromValues(0.0, 0.0, 3.0);
    var cameraTarget = vec3.fromValues(0.0, 0.0, 0.0);
    var diff = vec3.create();
    diff = vec3.subtract(diff, cameraPos, cameraTarget)
    var cameraDirection = vec3.normalize(diff,diff);
    var up = vec3.fromValues(0.0, 1.0, 0.0);
    var cross = vec3.create();
    var cross = vec3.cross(cross, up, cameraDirection);
    var cameraRight = vec3.normalize(cross, cross);
    var cameraUp = vec3.create();
    var cameraUp = vec3.cross(cameraUp, cameraDirection, cameraRight);

    const view = mat4.create();
    const projection = mat4.create();
    let color = vec3.create();

    function render(timeMs) {
        // create view matrix
        requestAnimationFrame(render);

        const time = timeMs * 0.001;

        gl.useProgram(shaderProgram);

        // View matrix
        const radius = 10.0;
        const camX = Math.sin(time) * radius;
        const camZ = Math.cos(time) * radius;
        let red   = 0.5 * Math.sin(time) + 0.5;
        let green = 0.5 * Math.sin(time + 2 * Math.PI / 3) + 0.5;
        let blue  = 0.5 * Math.sin(time + 4 * Math.PI / 3) + 0.5;
        color = vec3.fromValues(red,green,blue);
        gl.uniform3f(colorLoc, ...color);
        
        mat4.lookAt(view,
                    [camX*0.5, 0.0, camZ*0.5],
                    [0.0, 0.0, 0.0],
                    cameraUp
        );

        gl.uniformMatrix4fv(viewLoc, false, view);

        // Projection matrix
        const fovRadians = 45.0 * Math.PI / 180.0;
        mat4.perspective(
            projection,
            fovRadians,
            w/h,
            0.1,
            100.0
        );
        gl.uniformMatrix4fv(projectionLoc, false, projection);

        renderTriangles();
    }

    requestAnimationFrame(render);
} // end main
