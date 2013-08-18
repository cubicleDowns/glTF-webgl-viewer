/* <copyright>
Copyright (c) 2012, Motorola Mobility LLC.
All Rights Reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice,
  this list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of Motorola Mobility LLC nor the names of its
  contributors may be used to endorse or promote products derived from this
  software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
</copyright> */
/**
    @module "montage/ui/view.reel"
    @requires montage
    @requires montage/ui/component
*/

require("runtime/dependencies/gl-matrix");
var Montage = require("montage").Montage;
var Component = require("montage/ui/component").Component;
var GLSLProgram = require("runtime/glsl-program").GLSLProgram;
var ResourceManager = require("runtime/helpers/resource-manager").ResourceManager;
var glTFScene = require("runtime/glTF-scene").glTFScene;
var glTFNode = require("runtime/glTF-node").glTFNode;
var Scene = require("runtime/scene").Scene;
var Node = require("runtime/node").Node;
var SceneRenderer = require("runtime/scene-renderer").SceneRenderer;
var glTFMaterial = require("runtime/glTF-material").glTFMaterial;
var Utilities = require("runtime/utilities").Utilities;
var dom = require("montage/core/dom");
var Point = require("montage/core/geometry/point").Point;
var OrbitCamera = require("runtime/dependencies/camera.js").OrbitCamera;
var TranslateComposer = require("montage/composer/translate-composer").TranslateComposer;
var BuiltInAssets = require("runtime/builtin-assets").BuiltInAssets;
var WebGLRenderer = require("runtime/webgl-renderer").WebGLRenderer;
var URL = require("montage/core/url");
var Projection = require("runtime/projection").Projection;
var Camera = require("runtime/camera").Camera;

/**
    Description TODO
    @class module:"montage/ui/view.reel".view
    @extends module:montage/ui/component.Component
*/
exports.View = Component.specialize( {

    constructor: {
        value: function View() {
            this.super();
        }
    },

    _sceneTime: { value: 0, writable: true },
    _lastTime: { value: 0, writable: true },

    play: {
        value: function() {
            switch (this._state) {
                case this.PAUSE:
                case this.STOP:
                    this._lastTime = Date.now();
                    this._state = this.PLAY;
                    this.needsDraw = true;
                    break;
                default:
                    break;
            }

            this._state = this.PLAY;
        }
    },

    pause: {
        value: function() {
            this._state = this.PAUSE;
        }
    },

    _viewPointIndex: { value: 0, writable: true },

    automaticallyCycleThroughViewPoints: { value: true, writable: true },

    loops: { value: true, writable: true},

    stop: {
        value: function() {
            this._sceneTime = 0;
            this._state = this.STOP;
            this.needsDraw = true;
        }
    },

    STOP: { value: 0, writable: true },
    PLAY: { value: 1, writable: true },
    PAUSE: { value: 2, writable: true },

    _state: { value: 0, writable: true },

    _viewPoint: { value: null, writable: true },

    viewPoint: {
        get: function() {
            return this._viewPoint;
        },
        set: function(value) {
            if (this._viewPoint != value) {
                var previousViewPoint = null;
                if (this._viewPoint && value) {
                    if (this._viewPoint.scene == value.scene) {
                        previousViewPoint = this._viewPoint;
                    }
                }

                this._viewPoint = value;
                if (value) {
                    if (this.scene && (this._viewPoint.scene == null)) {
                        this._viewPoint.scene = this.scene;
                    }
                }
                var interpolatingViewPoint = null;
                if (this.sceneRenderer) {
                    if (value) {
                        if (this.scene) {
                            if (this.scene.glTFElement) {
                                var animationManager = this.scene.glTFElement.animationManager;
                                //we do not animate already animated cameras
                                var hasStaticViewPoint = animationManager.hasAnimation(value.id) == false;
                                if (hasStaticViewPoint == false && previousViewPoint != null) {
                                    hasStaticViewPoint |= animationManager.hasAnimation(previousViewPoint.id) == false;
                                }

                                if (hasStaticViewPoint) {
                                    interpolatingViewPoint = {"previous": previousViewPoint ? previousViewPoint.glTFElement : null, "step":0, "start" : Date.now(), "duration": 1000 }
                                }
                            }
                        }
                        this.interpolatingViewPoint = interpolatingViewPoint;
                        this.sceneRenderer.technique.rootPass.viewPoint = value ? value.glTFElement : null;
                        this.needsDraw = true;
                    }
                }
            }
        }
    },

    translateComposer: {
        value: null
    },

    modelController: {
        value: null
    },

    update: {
        value: function() {
            this.needsDraw = true;
        }
    },

    scaleFactor: { value: (window.devicePixelRatio || 1), writable: true},

    canvas: {
        get: function() {
            if (this.templateObjects) {
                              
                return this.templateObjects.canvas;
            } 
            return null;
        }
    },

    _orbitCamera: { value: null, writable: true },

    orbitCamera: {
        get: function() {
            return this._orbitCamera;
        },
        set: function(value) {
            this._orbitCamera = value;
        }
    },

    _sceneRenderer: { value: null, writable: true },

    sceneRenderer: {
        get: function() {
            return this._sceneRenderer;
        },
        set: function(value) {
            if (value != this._sceneRenderer) {
                this._sceneRenderer = value;
            }
        }
    },

    handleStatusChange: {
        value: function(status, key, object) {
            if (status === "loaded") {
                this.scene = object;
                this.needsDraw = true;
                this.interpolatingViewPoint = null;
            }
        }
    },

    _scene: { value: null, writable: true },

    scene: {
        get: function() {
            return this._scene;
        },

        set: function(value) {
            if (this.scene !== value) {
                var sceneReady = value != null ? (value.status == "loaded") : true; //force true if null
                this.viewPointModifierMatrix = mat4.identity();
                this.interpolatingViewPoint = null;

                //sort of a hack, only set the scene when ready
                if (!sceneReady) {
                    value.addOwnPropertyChangeListener("status", this);
                    return;
                }

                if (this.delegate && sceneReady) {
                    if (this.delegate.sceneWillChange) {
                        this.delegate.sceneWillChange();
                    }
                }

                this._scene = value;
                if (value.status == "loaded") {
                    this.applyScene(value);
                }

                if (this.delegate && sceneReady) {
                    if (this.delegate.sceneDidChange) {
                        this.delegate.sceneDidChange();
                    }
                }
            }
       }
    },

    //Test for https://github.com/KhronosGroup/glTF/issues/67
    /*
    loadMultipleScenesTest: {
        value: function() {
            var paths = [];
            paths.push( "model/parts/Part1.json" );
            paths.push( "model/parts/Part2.json" );
            paths.push( "model/parts/Part3.json" );

            var pathsIndex = 0;
            var mainScene = Object.create(glTFScene).init();
            var readerDelegate = {};
            readerDelegate.loadCompleted = function (scene) {
                mainScene.rootNode.children.push(scene.rootNode);
                pathsIndex++;
                if (paths.length === pathsIndex) {
                    this.needsDraw = true;
                    this.scene = mainScene;
                }
                //FIXME:HACK: loader should be passed as arg, also multiple observers should pluggable here so that the top level could just pick that size info. (for the progress)
            }.bind(this);

            paths.forEach( function(path) {
                var loader = Object.create(RuntimeTFLoader);
                loader.initWithPath(path);
                loader.delegate = readerDelegate;
                loader.load(null, null );
            }, this);
        }
    },
    */

    //scenePath is legacy and is kept just for compatibility for now
    scenePath: {
        set: function(value) {
            if (value) {
                var URLObject = URL.parse(value);
                if (!URLObject.scheme) {
                    var packages = Object.keys(require.packages);
                    //HACK: for demo, packages[0] is guaranted to be the entry point
                    value = URL.resolve(packages[0], value);
                }
            }

            if (this.scene) {
                if (value == this.scene.path) {
                    return;
                }
            }

            var scene = Montage.create(Scene).init();
            //this.scene = scene;
            scene.addOwnPropertyChangeListener("status", this);
            scene.path = value;
        },

        get: function() {
            return this.scene ? this.scene.path : null;
        }
    },

    //we don't want to cache this to avoid synchronization here, so we don't want to call it often either :)
    _getViewPoints: {
        value: function(scene) {
            var viewPoints = [];
            var node = scene.glTFElement.rootNode;
            node.apply( function(node, parent, parentTransform) {
                if (node.cameras) {
                    if (node.cameras.length)
                        viewPoints = viewPoints.concat(node);
                }
                return null;
            }, true, null);

            var m3dNodes = [];
            viewPoints.forEach( function(viewPoint) {
                var m3dNode = Montage.create(Node)
                m3dNode.scene = scene;
                m3dNode.id = viewPoint.baseId;
                m3dNodes.push(m3dNode);
            }, this);

            return m3dNodes;
        }
    },

    applyScene: {
        value:function (m3dScene) {
            var scene = m3dScene.glTFElement;
            if (this.sceneRenderer) {
                if (this.sceneRenderer.technique.rootPass) {
                    if (scene) {
                        this.orbitCamera = null;
                        var viewPoints= this._getViewPoints(m3dScene);
                        var hasCamera = viewPoints.length > 0;

                        //compute hierarchical bbox for the whole scene
                        //this will be removed from this place when node bounding box become is implemented as hierarchical
                        var ctx = mat4.identity();
                        var node = scene.rootNode;
                        var sceneBBox = null;
                        var self = this;
                        node.apply( function(node, parent, parentTransform) {
                            var modelMatrix = mat4.create();
                            mat4.multiply( parentTransform, node.transform.matrix, modelMatrix);
                            if (node.boundingBox) {
                                var bbox = Utilities.transformBBox(node.boundingBox, modelMatrix);

                                if (sceneBBox) {
                                    if (node.meshes) {
                                        if (node.meshes.length > 0)
                                            sceneBBox = Utilities.mergeBBox(bbox, sceneBBox);
                                    }
                                } else {
                                    sceneBBox = bbox;
                                }
                            }
                            return modelMatrix;
                        }, true, ctx);

                        // arbitry set first coming camera as the view point
                        if (viewPoints.length) {
                            var shouldKeepViewPoint = false;
                            if (this.viewPoint) {
                                if (this.viewPoint.scene) {
                                    shouldKeepViewPoint = this.viewPoint.scenePath === m3dScene.scenePath;
                                }
                            }
                            if (shouldKeepViewPoint === false) {
                                this.viewPoint = viewPoints[0];
                            }
                        } else {
                            //TODO: make that a default projection method
                            var projection = Object.create(Projection);
                            projection.initWithDescription( {   "projection":"perspective",
                                "yfov":45,
                                "aspectRatio":1,
                                "znear":0.1,
                                "zfar":100});

                            //create camera
                            var camera = Object.create(Camera).init();
                            camera.projection = projection;
                            //create node to hold the camera
                            var cameraNode = Object.create(glTFNode).init();
                            camera.name = cameraNode.name = "camera01";
                            cameraNode.id = "__default_camera";
                            cameraNode.baseId = cameraNode.id;
                            scene.ids[cameraNode.baseId] = cameraNode;
                            cameraNode.cameras.push(camera);
                            //FIXME: find out why even when checking that we mergeBBOX of meshes only the highest level BBOX is still wrong if camera is added to the scene.
                            //scene.rootNode.children.push(cameraNode);
                            var m3dNode = Montage.create(Node);
                            m3dNode.scene = m3dScene;
                            m3dNode.id = cameraNode.baseId;
                            this.viewPoint = m3dNode;
                        }

                        if (sceneBBox && !hasCamera) {
                            var sceneSize = [(sceneBBox[1][0] - sceneBBox[0][0]) ,
                                (sceneBBox[1][1] - sceneBBox[0][1]) ,
                                (sceneBBox[1][2] - sceneBBox[0][2]) ];

                            //size to fit
                            var scaleFactor = sceneSize[0] > sceneSize[1] ? sceneSize[0] : sceneSize[1];
                            scaleFactor = sceneSize[2] > scaleFactor ? sceneSize[2] : scaleFactor;

                            scaleFactor =  1 / scaleFactor;
                            var scaleMatrix = mat4.scale(mat4.identity(), [scaleFactor, scaleFactor, scaleFactor]);
                            var center = vec3.createFrom(0,0,(sceneSize[2]*scaleFactor)/2);
                            //self.camera.setCenter(center);
                            var translationVector = vec3.createFrom(    -((sceneSize[0] / 2) + sceneBBox[0][0]),
                                -((sceneSize[1] / 2) + sceneBBox[0][1]),
                                -( sceneBBox[0][2]));

                            var translation = mat4.translate(scaleMatrix, [
                                translationVector[0],
                                translationVector[1],
                                translationVector[2]]);

                            mat4.set(translation, scene.rootNode.transform.matrix);
                        }

                    }
                    this.sceneRenderer.scene = scene;
                    if (scene) {
                        this.orbitCamera = new MontageOrbitCamera(this.canvas);
                        this.orbitCamera.translateComposer = this.translateComposer;
                        this.orbitCamera._hookEvents(this.canvas);
                        this.orbitCamera.constrainDistance = true;

                        this.orbitCamera.maxDistance = hasCamera ? 15 : 200;
                        this.orbitCamera.minDistance = hasCamera ? -45 : 0;

                        this.orbitCamera.setDistance(hasCamera ? 0 : 1.3);
                        this.orbitCamera.distanceStep = hasCamera ? 0.015 : 0.0001;
                        this.orbitCamera.setRideMode(hasCamera);
                        this.orbitCamera.setYUp(true);

                        //allow small interaction when a camera is present
                        if (hasCamera) {
                            this.orbitCamera.minOrbitX = -0.4;
                            this.orbitCamera.maxOrbitX = 0.4;
                            this.orbitCamera.minOrbitY = -0.4;
                            this.orbitCamera.maxOrbitY = 0.4;
                        }

                        this.orbitCamera.constrainXOrbit = hasCamera;
                        this.orbitCamera.constrainYOrbit = hasCamera;

                        if (center)
                            this.orbitCamera.setCenter(center);
                    }
                    this.needsDraw = true;
                    //right now, play by default
                    if (this.viewPoint) {
                        if (this.viewPoint.scene == null) {
                            this.viewPoint.scene = m3dScene;
                        }
                        if (this.sceneRenderer) {
                            this.interpolatingViewPoint = null;
                            this.viewPoint.glTFElement.presentationTransform = null;
                            this.sceneRenderer.technique.rootPass.viewPoint = this.viewPoint.glTFElement;
                        }
                    }
                    this.play();
                }
            }
        }
    },

    getRelativePositionToCanvas: {
        value: function(event) {
            return dom.convertPointFromPageToNode(this.canvas, Point.create().init(event.pageX, event.pageY));
        }
    },

    _disableRendering: { value: false, writable: true },

    enterDocument: {
        value: function(firstTime) {
            var simulateContextLoss = false;  //Very naive for now
            var self = this;

            if (simulateContextLoss) {
                this.canvas = WebGLDebugUtils.makeLostContextSimulatingCanvas(this.canvas);
            }

            var webGLContext = this.canvas.getContext("experimental-webgl", { antialias: true, preserveDrawingBuffer: true}) ||this.canvas.getContext("webgl", { antialias: true});
            var webGLRenderer = Object.create(WebGLRenderer).initWithWebGLContext(webGLContext);
            webGLContext.enable(webGLContext.DEPTH_TEST);
            var options = null;
            this.sceneRenderer = Object.create(SceneRenderer);
            this.sceneRenderer.init(webGLRenderer, options);
            this.sceneRenderer.webGLRenderer.resourceManager.observers.push(this);

            if (this.scene)
                this.applyScene(this.scene);

            this.canvas.addEventListener("webglcontextlost", function(event) {
                console.log("context was lost");
                event.preventDefault();
                self.sceneRenderer.webGLRenderer.resourceManager.reset();
                self.needsDraw = false;
                self._disableRendering = true;
            }, false);

            this.canvas.addEventListener("webglcontextrestored", function(event) {
                console.log("context was restored");
                event.preventDefault();
                webGLContext.enable(webGLContext.DEPTH_TEST);
                self.needsDraw = true;
                self._disableRendering = false;
            }, false);

            if (simulateContextLoss) {
                setTimeout(function() {
                    self.canvas.loseContext();
                }, 5000);
            }

            //setup gradient
            var self = this;
            var techniquePromise = BuiltInAssets.assetWithName("gradient");
            techniquePromise.then(function (scene) {
                self.gradientRenderer = Object.create(SceneRenderer);
                self.gradientRenderer.init(webGLRenderer, null);
                self.gradientRenderer.scene = scene;
                self.needsDraw = true;
            }, function (error) {
            }, function (progress) {
            });

            this.needsDraw = true;

            // TODO the camera does its own listening but doesn't know about our draw system
            // I'm minimizing impact to the dependencies as we get this all working so the listeners
            // here really don't do much other than trigger drawing. They listen on capture
            // to handle the event before the camera stopsPropagation (for whatever reason it does that)
            this.canvas.addEventListener('touchstart', this.start.bind(this), true);
            document.addEventListener('touchend', this.end.bind(this), true);
            document.addEventListener('touchcancel', this.end.bind(this), true);
            document.addEventListener('touchmove', this.move.bind(this), true);
            document.addEventListener('gesturechange', this, true);
            this.canvas.addEventListener('mousedown', this.start.bind(this), true);
            document.addEventListener('mouseup', this.end.bind(this), true);
            document.addEventListener('mousemove', this.move.bind(this), true);
            document.addEventListener('mousewheel', this, true);
        }
    },

    captureMousewheel: {
        value: function() {
            this.needsDraw = true;
        }
    },

    captureGesturechange: {
        value: function() {
            this.needsDraw = true;
        }
    },

    move:{
        value: function (event) {
            this.needsDraw = true;


            //no drag at the moment
            this._mousePosition = null;
        }
    },

    start: {
        value: function (event) {
            event.preventDefault();
            this._consideringPointerForPicking = true;
            var position = this.getRelativePositionToCanvas(event);
            this._mousePosition = [position.x * this.scaleFactor,  this.height - (position.y * this.scaleFactor)];

            if (this._state == this.PLAY) {
                this.pause();
            }
        }
    },

    end:{
        value: function (event) {

            if (this._consideringPointerForPicking && event.target === this.canvas) {
                event.preventDefault();
            }

            if (this._state == this.PAUSE) {
                this.play();
            }

            this._consideringPointerForPicking = false;
            this._mousePosition = null;
        }
    },

    /* returns an array of test results */
    hitTest: {
        value: function(position, options) {
            if (this.sceneRenderer) {
                if ((this.sceneRenderer.technique.rootPass) && (this.canvas)) {
                    var viewport = [0, 0, parseInt(this.canvas.getAttribute("width")), parseInt(this.canvas.getAttribute("height"))];
                    return this.sceneRenderer.technique.rootPass.hitTest(position, viewport, options);
                }
            }
            return null;
        }
    },

    getWebGLRenderer: {
        value: function() {
            return this.sceneRenderer ? this.sceneRenderer.webGLRenderer : null;
        }
    },

    getWebGLContext: {
        value: function() {
            var renderer = this.getWebGLRenderer();
            return renderer ? renderer.webGLContext : null;
        }
    },

    getResourceManager: {
        value: function() {
            var renderer = this.getWebGLRenderer();
            return renderer ? renderer.resourceManager : null;
        }
    },

    _consideringPointerForPicking: { writable: true, value: false },

    _mousePosition: { writable: true, value : null },

    _floorTextureLoaded : { writable: true, value: false },

    _showGradient: {
        value: false, writable: true
    },

    _showReflection: {
        value: false, writable: true
    },

    showBBOX: {
        value: false, writable: true
    },

    showGradient: {
        get: function() {
            return this._showGradient;
        },
        set: function(flag) {
            if (flag != this._showGradient) {
                this._showGradient = flag;
                this.needsDraw = true;
            }
        }
    },

    showReflection: {
        get: function() {
            return this._showReflection;
        },
        set: function(flag) {
            this._showReflection = flag;
            //if reflection (e.g floor) is enabled, then we constrain the rotation
            //if (flag && this.orbitCamera)
            //    this.orbitCamera.constrainXOrbit = flag;
        }
    },

    drawGradient: {
        value: function() {
            if (this.showGradient) {
                if (this.gradientRenderer) {
                    this.gradientRenderer.render();
                }
            }
        }
    },

    displayBBOX: {
        value: function(bbox, cameraMatrix, modelMatrix) {

            if (!this.sceneRenderer || !this.scene)
                return;
            if (!this.sceneRenderer.technique.rootPass.viewPoint)
                return;
            var gl = this.getWebGLContext();
            var self = this;

            this.sceneRenderer.webGLRenderer.bindedProgram = null;

            var viewPoint = this.viewPoint;
            var projectionMatrix = viewPoint.cameras[0].projection.matrix;

            gl.disable(gl.CULL_FACE);

            if (!this._BBOXProgram) {
                this._BBOXProgram = Object.create(GLSLProgram);

                var vertexShader =  "precision highp float;" +
                                    "attribute vec3 vert;"  +
                                    "uniform mat4 u_projMatrix; " +
                                    "uniform mat4 u_vMatrix; " +
                                    "uniform mat4 u_mMatrix; " +
                                    "void main(void) { " +
                                    "gl_Position = u_projMatrix * u_vMatrix * u_mMatrix * vec4(vert,1.0); }";

                var fragmentShader =    "precision highp float;" +
                                    "uniform float u_transparency; " +
                                        " void main(void) { " +
                                     " gl_FragColor = vec4(vec3(1.,1.,1.) , u_transparency);" +
                                    "}";

                this._BBOXProgram.initWithShaders( {    "x-shader/x-vertex" : vertexShader , 
                                                        "x-shader/x-fragment" : fragmentShader } );
                if (!this._BBOXProgram.build(gl))
                    console.log(this._BBOXProgram.errorLogs);
            }

            var min = [bbox[0][0], bbox[0][1], bbox[0][2]];
            var max = [bbox[1][0], bbox[1][1], bbox[1][2]];

            var X = 0;
            var Y = 1;
            var Z = 2;

            if (!this._BBOXIndices) {
                var indices = [ 0, 1,
                                1, 2,
                                2, 3,
                                3, 0,
                                4, 5,
                                5, 6,
                                6, 7,
                                7, 4,
                                3, 7,
                                2, 6,
                                0, 4,
                                1, 5];

                this._BBOXIndices = gl.createBuffer();
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._BBOXIndices);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
            }
            
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._BBOXIndices);

            if (!this._BBOXVertexBuffer) {
                this._BBOXVertexBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, this._BBOXVertexBuffer);
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, this._BBOXVertexBuffer);

            var vertices = [
                    max[X], min[Y], min[Z], 
                    max[X], max[Y], min[Z], 
                    min[X], max[Y], min[Z], 
                    min[X], min[Y], min[Z], 
                    max[X], min[Y], max[Z], 
                    max[X], max[Y], max[Z], 
                    min[X], max[Y], max[Z], 
                    min[X], min[Y], max[Z]
            ];
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

            var vertLocation = this._BBOXProgram.getLocationForSymbol("vert");
            if (typeof vertLocation !== "undefined") {
                gl.enableVertexAttribArray(vertLocation);
                gl.vertexAttribPointer(vertLocation, 3, gl.FLOAT, false, 12, 0);
            }

            this.sceneRenderer.webGLRenderer.bindedProgram = this._BBOXProgram;

            var projectionMatrixLocation = this._BBOXProgram.getLocationForSymbol("u_projMatrix");
            if (projectionMatrixLocation) {
                this._BBOXProgram.setValueForSymbol("u_projMatrix",projectionMatrix);
            }

            var mMatrixLocation = this._BBOXProgram.getLocationForSymbol("u_mMatrix");
            if (mMatrixLocation) {
                this._BBOXProgram.setValueForSymbol("u_mMatrix",modelMatrix);
            }

            var vMatrixLocation = this._BBOXProgram.getLocationForSymbol("u_vMatrix");
            if (vMatrixLocation) {
                this._BBOXProgram.setValueForSymbol("u_vMatrix",cameraMatrix);
            }

            var transparency = this._BBOXProgram.getLocationForSymbol("u_transparency");
            if (transparency) {
                this._BBOXProgram.setValueForSymbol("u_transparency",1 /*mesh.step*/);
            }

            this._BBOXProgram.commit(gl);
            //void drawElements(GLenum mode, GLsizei count, GLenum type, GLintptr offset);
            gl.drawElements(gl.LINES, 24, gl.UNSIGNED_SHORT, 0);
            gl.disableVertexAttribArray(vertLocation);

            gl.disable(gl.BLEND);
            gl.enable(gl.CULL_FACE);
        }
    },

    selectedNode: { value: null, writable:true },

    handleSelectedNode: {
        value: function(nodeID) {
            if (this.orbitCamera)
                this.displayAllBBOX(this.orbitCamera.getViewMat(), nodeID);
            else {
                var mat = mat4.create();
                mat4.inverse(this.viewPoint.glTFElement.transform.matrix, mat);
                this.displayAllBBOX(mat, nodeID);
            }

        }
    },

    displayAllBBOX: {
        value: function(cameraMatrix, selectedNodeID) {
            if (!this.scene || !this.showBBOX)
                return;
            if (this.scene.glTFElement) {
                var ctx = mat4.identity();
                var node = this.scene.glTFElement.rootNode;
                var self = this;

                node.apply( function(node, parent, parentTransform) {
                    var modelMatrix = mat4.create();
                    mat4.multiply( parentTransform, node.transform.matrix, modelMatrix);
                    if (node.boundingBox && node.id == selectedNodeID) {
                        self.displayBBOX(node.boundingBox, cameraMatrix, modelMatrix);
                    }
                    return modelMatrix;
                }, true, ctx);
            }
        }
    },

    _width: {
        value: null
    },

    width: {
        get: function() {
            return this._width;
        },
        set: function(value) {
            if (value != this._width) {
                this._width = value * this.scaleFactor;
                this.needsDraw = true;
            }
        }
    },

    _height: {
        value: null
    },

    height: {
        get: function() {
            return this._height;
        },
        set: function(value) {
            if (value != this._height) {
                this._height = value * this.scaleFactor;
                this.needsDraw = true;
            }
        }
    },
    _cameraAnimating:{
        value:true
    },

    cameraAnimating:{
        get:function () {
            return this._cameraAnimating;
        },
        set:function (value) {
            this.orbitCameraAnimatingXVel = 0;
            this.orbitCameraAnimatingYVel = 0;
            this._cameraAnimating = value;
        }
    },

    cameraAnimatingXVel:{
        value: 0
    },
    cameraAnimatingYVel:{
        value: 0
    },

    interpolatingViewPoint: {
        value: null, writable:true
    },

    draw: {
        value: function() {

            if (!this._scene)
                return;
            if (!this.viewPoint)
                return;
            if (this._disableRendering)
                return;
            var viewPoint = this.viewPoint;
            var self = this;

            var time = Date.now();
            if (this.interpolatingViewPoint) {
                if ((time - this.interpolatingViewPoint.start) < this.interpolatingViewPoint.duration) {
                    this.needsDraw = true;
                } else {
                    this.interpolatingViewPoint = null;
                }
            }

            if (this.sceneRenderer && this.scene) {
                var animationManager = this.scene.glTFElement.animationManager;
                if (this._state == this.PLAY && animationManager) {
                    this._sceneTime += time - this._lastTime;
                    if (this.scene.glTFElement.duration !== -1) {
                        if (this._sceneTime / 1000. > this.scene.glTFElement.duration) {
                            if (this.automaticallyCycleThroughViewPoints == true) {
                                var viewPoints = this._getViewPoints(this.scene);
                                if (viewPoints.length > 0) {
                                    var nextViewPoint;
                                    var checkIdx = 0;
                                    do {
                                        this._sceneTime = 0;
                                        this._viewPointIndex++;
                                        checkIdx++;
                                        this._viewPointIndex = this._viewPointIndex % viewPoints.length;
                                        nextViewPoint = viewPoints[this._viewPointIndex];
                                    } while ((checkIdx < viewPoints.length) && (animationManager.hasAnimation(nextViewPoint.id) == false));
                                    this.viewPoint = nextViewPoint;
                                }
                            }
                            if (this.loops) {
                                this._sceneTime = this._sceneTime % this.scene.glTFElement.duration;
                           } else {
                                this.stop();
                            }
                        }
                    }

                    this.scene.glTFElement.animationManager.updateTargetsAtTime(this._sceneTime, this.sceneRenderer.webGLRenderer.resourceManager);
                }
            }
            this._lastTime = time;

            var webGLContext = this.getWebGLContext();
            webGLContext.viewport(0, 0, this._width, this._height);
            if (webGLContext) {
                webGLContext.clearColor(0,0,0,0.);
                webGLContext.clear(webGLContext.DEPTH_BUFFER_BIT | webGLContext.COLOR_BUFFER_BIT);
            }

            //----
            if (this.viewPoint) {
                if (this.viewPoint.glTFElement)
                    this.viewPoint.glTFElement.cameras[0].projection.aspectRatio =  this._width / this._height;
            }

            if (this.orbitCamera) {
                var hasAnimation = false;
                var cameraMatrix = this.orbitCamera.getViewMat();

                if (this.scene) {
                    if (this.scene.glTFElement.animationManager) {
                        if (this.scene.glTFElement.animationManager.animations) {
                            hasAnimation = true;
                        }
                    }
                }
            }

            var webGLContext = this.getWebGLContext(),
                renderer,
                width,
                height;


            mat4.set(cameraMatrix, this.viewPointModifierMatrix);

           if(this.orbitCamera && this.orbitCameraAnimating) {
                if (this.orbitCameraAnimatingXVel < 0.0013) {
                    this.orbitCameraAnimatingXVel += 0.00001
                }
                if (this.orbitCameraAnimatingYVel > -0.0005) {
                    this.orbitCameraAnimatingYVel -= 0.000005
                }

                this.orbitCamera.orbit(this.orbitCameraAnimatingXVel, this.orbitCameraAnimatingYVel);
                this.needsDraw = true;
            }
            if (this._state == this.PLAY)
               this.needsDraw = true;

            if (this.scene) {
                renderer = this.sceneRenderer.webGLRenderer;
                if (webGLContext) {
                    width = this._width;
                    height = this._height;

                    //as indicated here: http://www.khronos.org/webgl/wiki/HandlingHighDPI
                    //set draw buffer and canvas size
                    this.canvas.style.width = (this._width / this.scaleFactor) + "px";
                    this.canvas.style.height = (this._height / this.scaleFactor) + "px";
                    this.canvas.width = this._width;
                    this.canvas.height = this._height;

                    /* ------------------------------------------------------------------------------------------------------------
                        Draw reflected scene
                            - enable depth testing
                            - enable culling
                     ------------------------------------------------------------------------------------------------------------ */
                    if(this.showReflection && this.orbitCamera) {
                        webGLContext.depthFunc(webGLContext.LESS);
                        webGLContext.enable(webGLContext.DEPTH_TEST);
                        webGLContext.frontFace(webGLContext.CW);
                        var savedTr = mat4.create();

                        var rootNode = this.scene.glTFElement.rootNode;

                        var node = rootNode;
                        //save car matrix
                        mat4.set(rootNode.transform.matrix, savedTr);
                        webGLContext.depthMask(true);

                        var translationMatrix = mat4.translate(mat4.identity(), [0, 0, 0 ]);
                        var scaleMatrix = mat4.scale(translationMatrix, [1, 1, -1]);
                        mat4.multiply(scaleMatrix, node.transform.matrix) ;
                        rootNode.transform.matrix = scaleMatrix;

                        //FIXME: passing a matrix was the proper to do this, but right now matrix updates are disabled (temporarly)
                        this.sceneRenderer.technique.rootPass.viewPoint.flipped = true;

                        this.sceneRenderer.render(time);
                        webGLContext.depthMask(true);
                        this.sceneRenderer.technique.rootPass.viewPoint.flipped = false;

                        rootNode.transform.matrix = savedTr;
                    }
                    
                    //restore culling order
                    webGLContext.frontFace(webGLContext.CCW);

                   // webGLContext.disable(webGLContext.DEPTH_TEST);
                    //webGLContext.depthMask(false);
                    this.drawGradient();
                    //this.drawFloor(cameraMatrix);
                    webGLContext.depthMask(true);

                    webGLContext.depthFunc(webGLContext.LESS);
                    //webGLContext.enable(webGLContext.DEPTH_TEST);
                    webGLContext.enable(webGLContext.CULL_FACE);
                    webGLContext.disable(webGLContext.BLEND);

                    if (this._mousePosition) {
                        this.sceneRenderer.render(time, {    "picking" : true,
                            "coords" : this._mousePosition,
                            "delegate" : this,
                            "viewPointModifierMatrix" : this.viewPointModifierMatrix,
                            "interpolatingViewPoint" : this.interpolatingViewPoint
                        });
                    }

                    this.sceneRenderer.render(time, {
                        "viewPointModifierMatrix" : this.viewPointModifierMatrix,
                        "interpolatingViewPoint" : this.interpolatingViewPoint

                    });

                    webGLContext.flush();

                    var error = webGLContext.getError();
                    if (error != webGLContext.NO_ERROR) {
                        console.log("gl error"+webGLContext.getError());
                    }
                    
                    //this.displayAllBBOX(cameraMatrix);
                }
            }
        }
    },

    resourceAvailable: {
        value: function(resource) {
            this.needsDraw = true;
        }
    },

    willDraw: {
        value: function() {

        }
    },

    templateDidLoad: {
        value: function() {
            self = this;
            window.addEventListener("resize", this, true);

            var parent = this.parentComponent;
            var animationTimeout = null;
            var composer = TranslateComposer.create();
            composer.animateMomentum = true;
            composer.hasMomentum = true;
            composer.allowFloats = true;
            composer.pointerSpeedMultiplier = 0.15;
            this.addComposerForElement(composer, this.canvas);

            composer.addPathChangeListener("translateY", function(notification) {
                self._consideringPointerForPicking = false;
                self.needsDraw = true;
            });

            composer.addPathChangeListener("translateX", function(notification) {
                self._consideringPointerForPicking = false;
                self.needsDraw = true;
            });

            composer.addEventListener('translateStart', function (event) {
                self.cameraAnimating = false;
                if(animationTimeout) {
                    clearTimeout(animationTimeout);
                }
            }, false);

            composer.addEventListener('translateEnd', function () {
                animationTimeout = setTimeout(function() {
                    self.cameraAnimating = true;
                    self.needsDraw = true;
                }, 3000)
            }, false);
            this.translateComposer = composer;

        }
    },

});


var MontageOrbitCamera = OrbitCamera;
MontageOrbitCamera.prototype = Montage.create(OrbitCamera.prototype);

MontageOrbitCamera.prototype._hookEvents = function (element) {
    var self = this, moving = false,
        lastX = 0, lastY = 0;

    if (!this.translateComposer)
        return;

    //==============
    // Mouse Events
    //==============

    this.translateComposer.addEventListener('translateStart', function (event) {
        moving = true;

        lastX = event.translateX;
        lastY = event.translateY;

    }, false);

    this.translateComposer.addEventListener('translate', function (event) {
        if (moving) {
            var xDelta = event.translateX  - lastX,
                yDelta = event.translateY  - lastY;

            lastX = event.translateX;
            lastY = event.translateY;

            self.orbit(xDelta * 0.013, yDelta * 0.013);
        }

    }, false);

    this.translateComposer.addEventListener('translateEnd', function () {
        moving = false;
    }, false);

    element.addEventListener('mousewheel', function (event) {
        self.setDistance(-self._distance[2] + (event.wheelDeltaY * self.distanceStep));
        event.preventDefault();
    }, false);

    element.addEventListener('gesturestart', function (event) {
        self.initialDistance = self._distance[2];
        event.preventDefault();
    }, false);

    element.addEventListener('gesturechange', function (event) {
        self.setDistance(-1 * self.initialDistance / event.scale);
        event.preventDefault();
    }, false);

};


