// Copyright (c) 2013, Fabrice ROBINET.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//  * Redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//  * Redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//
//  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
// DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
// THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

require("runtime/dependencies/gl-matrix");
var Base = require("runtime/base").Base;

var Channel = exports.Channel = Object.create(Base, {

    startTime: { value: 0, writable:true },

    endTime: { value: 0, writable:true },

    _sampler: { value: null, writable: true },

    sampler: {
        get: function() {
            return this._sampler;
        },
        set: function(value ) {
            this._sampler = value;
        }
    },

    _target: { value: null, writable: true },

    target: {
        get: function() {
            return this._target;
        },
        set: function(value ) {
            this._target = value;
        }
    },

    _path: { value: null, writable: true },

    path: {
        get: function() {
            return this._path;
        },
        set: function(value ) {
            this._path = value;
        }
    },

    parameterDelegate: {
        value: {
            handleError: function(errorCode, info) {
                console.log("ERROR:parameterDelegate:"+errorCode+" :"+info);
            },

            decode: function(arrayBuffer, parameter) {
                if (arrayBuffer, parameter) {
                    function str2ab(str) {
                        var buf = new ArrayBuffer(str.length);
                        var bufView = new Uint8Array(buf);
                        for (var i = 0 , strLen = str.length ; i<strLen ; i++) {
                            bufView[i] = str.charCodeAt(i);
                        }
                        return buf;
                    }

                    var resType = "text";

                    if (resType === "text") {
                        var bstream = new o3dgc.BinaryStream(str2ab(arrayBuffer));
                        var size = arrayBuffer.length;
                    }
                    else{
                        var bstream = new o3dgc.BinaryStream(arrayBuffer);
                        var size = arrayBuffer.byteLength;
                    }

                    var decoder = new o3dgc.DynamicVectorDecoder();
                    var dynamicVector = new o3dgc.DynamicVector();
                    var timer = new o3dgc.Timer();
                    timer.Tic();
                    decoder.DecodeHeader(dynamicVector, bstream);
                    timer.Toc();
                    console.log("DecodeHeader time (ms) " + timer.GetElapsedTime());
                    // allocate memory
                    if (dynamicVector.GetNVector() > 0 && dynamicVector.GetDimVector()) {
                        dynamicVector.SetVectors(new Float32Array(dynamicVector.GetNVector() * dynamicVector.GetDimVector()));
                        dynamicVector.SetMinArray(new Float32Array(dynamicVector.GetDimVector()));
                        dynamicVector.SetMaxArray(new Float32Array(dynamicVector.GetDimVector()));
                        dynamicVector.SetStride(dynamicVector.GetDimVector());
                    }
                    console.log("Dynamic vector info:"+parameter.id);
                    console.log("\t# vectors   " + dynamicVector.GetNVector());
                    console.log("\tdim         " + dynamicVector.GetDimVector());
                    // decode DV
                    timer.Tic();
                    decoder.DecodePlayload(dynamicVector, bstream);
                    timer.Toc();
                    console.log("DecodePlayload time " + timer.GetElapsedTime() + " ms, " + size + " bytes (" + (8.0 * size / dynamicVector.GetNVector()) + " bpv)");

                    return dynamicVector.GetVectors();
                }
            },

            convert: function (resource, ctx) {
                var parameter = ctx;
                if (parameter.extensions) {
                    var extensions = parameter.extensions;
                    var compression = extensions["Open3DGC-compression"];
                    if (compression) {
                        var compressionData = compression["compressedData"];
                        if (compressionData) {
                            return this.decode(resource, ctx);
                        }
                    }
                }

                return new Float32Array(resource);
            },

            resourceAvailable: function (convertedResource, ctx) {
            }
        }
    },

    getParameterArray: {
        value: function(parameter, resourceManager) {
            if (parameter.extensions) {
                var extensions = parameter.extensions;
                var compression = extensions["Open3DGC-compression"];
                if (compression) {
                    var compressionData = compression["compressedData"];
                    if (compressionData) {
                        return resourceManager.getResource(compressionData, this.parameterDelegate, parameter);
                    }
                }
            }
            return resourceManager.getResource(parameter, this.parameterDelegate, parameter);
        }
    },

    //This is not definitive... it's like this just for early testing
    updateTargetsAtTime: {
        value: function(time, resourceManager) {

            var inputParameter = this.sampler.input;
            var outputParameter = this.sampler.output;
            var inputArray = this.getParameterArray(inputParameter, resourceManager);
            var outputArray = this.getParameterArray(outputParameter, resourceManager);
            if (inputArray && outputArray) {
                time /= 1000;
                var count = inputParameter.count;

                this.endTime = inputArray[count - 1];
                this.startTime = inputArray[0];
                //time %= this.endTime;

                var lastKeyIndex = 0;
                var i;
                var keyIndex = 0;
                var ratio = 0;
                var timeDelta = 0;
                var found = false;

                var allBefore = true;
                var allAfter = true;
                if (count > 0) {
                    if (time < this.startTime) {
                        ratio = 0;
                        lastKeyIndex = 0;
                    } else if (time >= this.endTime) {
                        ratio = 1;
                        lastKeyIndex = count - 2;
                    } else {
                        for (i = lastKeyIndex ; i < count - 1 ; i++) {
                            if ((inputArray[i] <= time) && (time < inputArray[i+1])) {
                                lastKeyIndex = i;
                                timeDelta = inputArray[i+1] - inputArray[i];
                                ratio = (time - inputArray[i]) / timeDelta;
                                break;
                            }
                        }
                    }

                    if (this.__vec4 == null) {
                        this.__vec4 = vec4.create();
                    }
                    if (this.__vec3 == null) {
                        this.__vec3 = vec3.create();
                    }
                    if (this.__vec2 == null) {
                        this.__vec2 = vec2.create();
                    }

                    var interpolatedValue = null;
                    switch (outputParameter.componentsPerAttribute) {
                        case 4 :
                            interpolatedValue = this.__vec4;
                            break;
                        case 3 :
                            interpolatedValue = this.__vec3;
                            break;
                        case 2 :
                            interpolatedValue = this.__vec2;
                            break;
                        case 1 :
                            console.log("float interpolation not handled yet");
                            break;
                        default:
                            break;
                    }

                    this.index = lastKeyIndex;

                    var idx1 = lastKeyIndex * outputParameter.componentsPerAttribute;
                    var idx2 = idx1 + outputParameter.componentsPerAttribute;
                    if (this.path == "rotation") {
                        var AXIS_ANGLE_INTERP = 0;
                        var AXIS_ANGLE_INTERP_NAIVE = 1;
                        var QUATERNION = 2;

                        var interpolationType = QUATERNION;//AXIS_ANGLE_INTERP_NAIVE;

                        if (interpolationType == AXIS_ANGLE_INTERP) {
                            var axisAngle1 = vec4.createFrom(outputArray[idx1 + 0],outputArray[idx1 + 1],outputArray[idx1 + 2],outputArray[idx1 + 3]);
                            var axisAngle2 = vec4.createFrom(outputArray[idx2 + 0],outputArray[idx2 + 1],outputArray[idx2 + 2],outputArray[idx2 + 3]);

                            vec3.normalize(axisAngle1); //FIXME: do that upfront
                            vec3.normalize(axisAngle2);
                            //get the rotation axis from the cross product
                            var rotAxis = vec3.create();
                            vec3.cross(axisAngle1, axisAngle2, rotAxis);

                            var lA1 = Math.sqrt(vec3.dot(axisAngle1,axisAngle1));
                            var lA2 = Math.sqrt(vec3.dot(axisAngle2,axisAngle2));
                            //var rotAxis = vec3.createFrom(Bx,By,Bz);
                            //vec3.normalize(rotAxis);

                            //now the rotation angle
                            var angle = Math.acos(vec3.dot(axisAngle1,axisAngle2));
                            var axisAngleRotMat = mat4.identity();
                            mat4.rotate(axisAngleRotMat, angle * ratio, rotAxis);

                            mat4.multiplyVec3(axisAngleRotMat, axisAngle1, rotAxis);
                            vec3.normalize(rotAxis);

                            var interpolatedAngle = axisAngle1[3]+((axisAngle2[3]-axisAngle1[3]) * ratio);
                            quat4.fromAngleAxis(interpolatedAngle, rotAxis, interpolatedValue);
                        } else if (interpolationType == AXIS_ANGLE_INTERP_NAIVE) {
                            var axisAngle1 = vec4.createFrom(outputArray[idx1 + 0],outputArray[idx1 + 1],outputArray[idx1 + 2],outputArray[idx1 + 3]);
                            var axisAngle2 = vec4.createFrom(outputArray[idx2 + 0],outputArray[idx2 + 1],outputArray[idx2 + 2],outputArray[idx2 + 3]);

                            //direct linear interpolation of components, to be considered for small angles
                            for (i = 0 ; i < interpolatedValue.length ; i++) {
                                var v1 = axisAngle1[ i];
                                var v2 = axisAngle2[ i];
                                axisAngle2[i] = v1 + ((v2 - v1) * ratio);
                            }
                            quat4.fromAngleAxis(axisAngle2[3], axisAngle2, interpolatedValue);
                        } else if (interpolationType == QUATERNION) {

                            if (this._quats == null) {
                                this._quats = [];

                                this._quats.push(quat4.create());
                                this._quats.push(quat4.create());
                            }

                            if (this._vecs == null) {
                                this._vecs = [];

                                this._vecs.push(vec3.create());
                                this._vecs.push(vec3.create());
                            }

                            this._vecs[0][0] = outputArray[idx1 + 0];
                            this._vecs[0][1] = outputArray[idx1 + 1];
                            this._vecs[0][2] = outputArray[idx1 + 2];

                            this._vecs[1][0] = outputArray[idx2 + 0];
                            this._vecs[1][1] = outputArray[idx2 + 1];
                            this._vecs[1][2] = outputArray[idx2 + 2];

                            var k1 = this._quats[0];
                            var k2 = this._quats[1];

                            quat4.fromAngleAxis(outputArray[idx1 + 3],
                                this._vecs[0], k1);
                            quat4.fromAngleAxis(outputArray[idx2 + 3],
                                this._vecs[1], k2);
                            quat4.slerp(k1, k2, ratio, interpolatedValue);
                        }

                    } else {
                        for (i = 0 ; i < interpolatedValue.length ; i++) {
                            var v1 = outputArray[idx1 + i];
                            var v2 = outputArray[idx2 + i];
                            interpolatedValue[i] = v1 + ((v2 - v1) * ratio);
                        }
                    }
                    this.target.transform[this.path] = interpolatedValue;
                }
            }
        }
    },

    initWithDescription: {
        value: function(description) {
            this.init();
            this.index = 0;
            this.target = description.target; //this will be overriden with the object

            return this;
        }
    },

    init: {
        value: function() {
            this.__Base_init();
            return this;
        }
    }

});

var Sampler = Object.create(Base, {
    _input: { value: null, writable: true },

    input: {
        get: function() {
            return this._input;
        },
        set: function(value ) {
            this._input = value;
        }
    },

    _output: { value: null, writable: true },

    output: {
        get: function() {
            return this._output;
        },
        set: function(value ) {
            this._output = value;
        }
    },

    initWithDescription: {
        value: function(description) {
            this.init();

            return this;
        }
    },

    init: {
        value: function() {
            this.__Base_init();
            return this;
        }
    }

});

exports.Animation = Object.create(Base, {

    _count: { value: 0, writable: true },

    _parameters: { value: null, writable: true },

    _channels: { value: null, writable: true },

    _samplers: { value: null, writable: true },

    _startTime: { value: 0, writable: true },

    _endTime: { value: 0, writable: true },

    channels: {
        get: function() {
            return this._channels;
        },
        set: function(value ) {
            this._channels = value;
        }
    },

    samplers: {
        get: function() {
            return this._samplers;
        },
        set: function(value ) {
            this._samplers = value;
        }
    },

    parameters: {
        get: function() {
            return this._parameters;
        },
        set: function(value ) {
            this._parameters = value;
        }
    },

    count: {
        get: function() {
            return this._count;
        },
        set: function(value ) {
            this._count = value;
        }
    },

    startTime: {
        get: function() {
            if (this.channels) {
                if (this.channels.length > 0) {
                    var startTime = this.channels[0].startTime;
                    for (var i = 1 ; i < this.channels.length ; i++ ) {
                        if (this.channels[i].startTime < startTime) {
                            startTime = this.channels[i].startTime;
                        }
                    }
                    return startTime;
                }
                return 0;
            }
        }
    },

    endTime: {
        get: function() {
            if (this.channels) {
                if (this.channels.length > 0) {
                    var endTime = this.channels[0].endTime;
                    for (var i = 1 ; i < this.channels.length ; i++ ) {
                        if (this.channels[i].endTime > endTime) {
                            endTime = this.channels[i].endTime;
                        }
                    }
                    return endTime;
                }
                return 0;
            }
        }
    },

    updateTargetsAtTime: {
        value: function(time, resourceManager) {
            this.channels.forEach( function(channel) {
                channel.updateTargetsAtTime(time, resourceManager);
            }, this);
        }

    },

    initWithDescription: {
        value: function(description) {
            this.init();

            this.count = description.count;

            var parameters = {};
            Object.keys(description.samplers).forEach( function(samplerID) {
                var samplerDescription = description.samplers[samplerID];
                var sampler = Object.create(Sampler).initWithDescription(samplerDescription);
                this.samplers[samplerID] = sampler;
            }, this);


            description.channels.forEach( function(channelDescription) {
                var animationChannel = Object.create(Channel).initWithDescription(channelDescription);

                animationChannel.sampler = this.samplers[channelDescription.sampler];
                animationChannel.target = channelDescription.target;

                this.channels.push(animationChannel);
            }, this);

            return this;
        }
    },

    init: {
        value: function() {
            this.__Base_init();
            this.channels = [];
            this.samplers = {};
            return this;
        }
    }
});

