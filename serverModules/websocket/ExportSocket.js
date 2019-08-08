var controller = require('../Controller'),
        fs = require('fs-extra'),
        uniqueFilename = require('unique-filename'),
        path = require('path'),
        SubmissionHandlerAVS = require('../submission/SubmissionHandlerAVS'),
        svgBuilder = require('svg-builder');

var exportDir = "csv";
var exportPath = process.cwd() + "/public/" + exportDir + "/";

// TODO refactor, currently only a dirty hack...
// TODO extend for LSC tasks

class ExportSocket {

    static registerEvents(socket) {

        var db = controller.db;

        // make sure that required directories exist
        if (!fs.existsSync(exportPath)) {
            fs.mkdirSync(exportPath);
            console.log("creating directory '" + exportPath + "'");
        }

        socket.on("exportTasks", (data, callback) => {
            var csv = "taskId;name;startTime;maxSearchTime;type;videoNumber;startFrame;endFrame;text1;text2;text3;trecvidId;avsText\n";
            db.findCompetition({_id: data.competitionId}, (competition) => {
                if (competition) {
                    db.findTasks({competitionId: data.competitionId}, (tasks) => {  // load all tasks of this competition
                        for (var i = 0; i < competition.taskSequence.length; i++) {     // proceed in the order of task execution
                            var taskId = competition.taskSequence[i];
                            var taskIdx = i + 1;
                            var task = tasks.find((t) => t._id == taskId);
                            if (task.finished) {
                                csv += taskIdx + ";" + task.name + ";" + (new Date(task.startTimeStamp)).toLocaleString() + ";"
                                        + task.maxSearchTime + ";" + task.type + ";";
                                if (task.type.startsWith("KIS")) {
                                    var r = task.videoRanges[0];
                                    csv += r.videoNumber + ";" + r.startFrame + ";" + r.endFrame + ";";
                                    if (task.type.startsWith("KIS_Textual") || task.type.startsWith("KIS_VisualTextual")) {
                                        
                                        // Iterate over all texts
                                        let ii = 0
                                        for (; ii < Math.min(3, task.textList.length); ++ii)
                                        {
                                            csv += task.textList[ii].text.replace(/\r?\n|\r/g, " ") + ";";
                                        }
                                        for (; ii < 3; ++ii)
                                        {
                                            csv += ";";
                                        }
                                        
                                    } else {
                                        csv += ";;;";
                                        
                                    }
                                } else if (task.type.startsWith("AVS")) {
                                    csv += ";;;;;;" + task.trecvidId + ";" + task.avsText;
                                } else if (task.type.startsWith("LSC")) {
                                    csv += "TODO: implement export for LSC tasks";
                                }
                            }
                            csv += "\n";
                        }
                        ExportSocket.saveAndRespond(csv, "tasks", socket, callback);
                    });
                } else {

                }
            });
        });

        socket.on("exportTaskResults", (data, callback) => {
            var csv = "year;team;isTop3;taskId;taskType;desc;trecvidId;expert/novice;searchTime;numAttempts;success;score\n";
            db.findCompetition({_id: data.competitionId}, (competition) => {
                var year = (new Date(competition.startTimeStamp)).getFullYear();
                db.findTasks({competitionId: data.competitionId}, (tasks) => {                  // load all tasks of this competition
                    db.findTaskResults({competitionId: data.competitionId}, (taskResults) => {  // load all task results of this competition
                        db.findTeams({competitionId: data.competitionId}, (teams) => {     // load all teams of this competition
                            var teamMap = {};
                            for (var i = 0; i < teams.length; i++) {
                                teamMap[teams[i]._id] = teams[i];
                            }
                            for (var i = 0; i < competition.taskSequence.length; i++) {     // proceed in the order of task execution
                                var taskId = competition.taskSequence[i];
                                var taskIdx = i + 1;
                                var task = tasks.find((t) => t._id == taskId);
                                if (task.finished) {
                                    var results = taskResults.filter((t) => t.taskId == taskId);
                                    for (var j = 0; j < results.length; j++) {
                                        var tr = results[j];
                                        var teamName = teamMap[tr.teamId].name;
                                        var isTop3 = "";
                                        csv += year + ";" + teamName + ";" + isTop3 + ";"
                                                + taskIdx + ";" + task.type + ";" + task.name + ";"
                                                + (task.type.startsWith("AVS") ? task.trecvidId : "") + ";"
                                                + (task.type.includes("novice") ? "novice" : "expert") + ";"
                                                + ((tr.searchTimes.length > 0) ? tr.searchTimes[0] : task.maxSearchTime) + ";"
                                                + tr.numAttempts + ";" + ((tr.numCorrect > 0) ? true : false) + ";" + tr.taskScore + "\n";
                                    }
                                }
                            }
                            ExportSocket.saveAndRespond(csv, "taskResults", socket, callback);
                        });
                    });
                });
            });
        });

        socket.on("exportSubmissions", (data, callback) => {
            var csv = "taskId;taskType;expert/novice;teamNumber;teamName;teamMember;videoNumber;shotNumber;frameNumber;searchTime;judged;correct\n";
            db.findCompetition({_id: data.competitionId}, (competition) => {
                db.findSubmissions({competitionId: data.competitionId}, (submissions) => {
                    db.findTeams({competitionId: data.competitionId}, (teams) => {
                        var teamMap = {};
                        for (var i = 0; i < teams.length; i++) {
                            teamMap[teams[i]._id] = teams[i];
                        }
                        db.findTasks({competitionId: data.competitionId}, (tasks) => {      // load all tasks of this competition
                            for (var i = 0; i < competition.taskSequence.length; i++) {     // proceed in the order of task execution
                                var taskId = competition.taskSequence[i];
                                var taskIdx = i + 1;
                                var task = tasks.find((t) => t._id == taskId);
                                if (task.finished) {
                                    var sub = submissions.filter((s) => s.taskId == taskId);
                                    sub.sort((a, b) => a.searchTime - b.searchTime);
                                    for (var j = 0; j < sub.length; j++) {
                                        var s = sub[j];
                                        csv += taskIdx + ";" + task.type + ";" + (task.type.includes("novice") ? "novice" : "expert") + ";"
                                                + s.teamNumber + ";" + teamMap[s.teamId].name + ";" + s.memberNumber + ";"
                                                + s.videoNumber + ";" + s.shotNumber + ";" + s.frameNumber + ";"
                                                + s.searchTime + ";" + s.judged + ";" + s.correct + "\n";
                                    }
                                }
                            }
                            ExportSocket.saveAndRespond(csv, "submissions", socket, callback);
                        });
                    });
                });
            });
        });

        socket.on("exportAvsStatistics", (data, callback) => {
            var csv = "taskId;team;total;correct;incorrect;ranges;videos;score\n";

            db.findCompetition({_id: data.competitionId}, (competition) => {
                db.findTeams({competitionId: data.competitionId}, (teams) => {
                    var teamMap = {};
                    for (var i = 0; i < teams.length; i++) {
                        teamMap[teams[i]._id] = teams[i];
                    }
                    db.findTasks({competitionId: data.competitionId, type: /AVS/, finished: true}, (tasks) => {      // load all finished AVS tasks
                        var taskIds = tasks.map((t) => t._id);
                        db.findTaskResults({taskId: {$in: taskIds}}, (taskResults) => {

                            taskResults.sort((a, b) => {
                                var taskIdxA = competition.taskSequence.indexOf(a.taskId) + 1;
                                var taskIdxB = competition.taskSequence.indexOf(b.taskId) + 1;
                                if (taskIdxA != taskIdxB) {
                                    return taskIdxA - taskIdxB;
                                } else if (teamMap[a.teamId].name < teamMap[b.teamId].name) {
                                    return -1;
                                } else if (teamMap[a.teamId].name > teamMap[b.teamId].name) {
                                    return 1;
                                }
                                return 0;
                            });

                            for (var i = 0; i < taskResults.length; i++) {
                                var tr = taskResults[i];
                                var taskIdx = competition.taskSequence.indexOf(tr.taskId) + 1;
                                csv += taskIdx + ";" + teamMap[tr.teamId].name + ";"
                                        + tr.numAttempts + ";" + tr.numCorrect + ";" + tr.numWrong + ";"
                                        + tr.numRanges + ";" + tr.numVideos + ";" + tr.taskScore + "\n";
                            }

                            db.findSubmissions({taskId: {$in: taskIds}}, (submissions) => {

                                tasks.sort((a, b) => {
                                    var taskIdxA = competition.taskSequence.indexOf(a._id) + 1;
                                    var taskIdxB = competition.taskSequence.indexOf(b._id) + 1;
                                    return taskIdxA - taskIdxB;
                                });

                                csv += "taskId;submissions;correct;shots;ranges;videos\n";
                                for (var i = 0; i < tasks.length; i++) {
                                    var task = tasks[i];
                                    var taskIdx = competition.taskSequence.indexOf(task._id) + 1;
                                    var taskSubmissions = submissions.filter((s) => s.taskId == task._id);
                                    var correctSubmissions = taskSubmissions.filter((s) => s.correct);
                                    var numSubmissions = taskSubmissions.length;
                                    var numCorrect = correctSubmissions.length
                                    var numVideos = (new Set(correctSubmissions.map((s) => s.videoNumber))).size;
                                    var numShots = (new Set(correctSubmissions.map((s) => s.videoNumber + "_" + s.shotNumber))).size;
                                    var avsHandler = new SubmissionHandlerAVS({db: db});
                                    for (var j=0; j<taskSubmissions.length; j++) {
                                        avsHandler.extendCorrectPool(taskSubmissions[j]);
                                    }
                                    var numRanges = avsHandler.numRanges;

                                    csv += taskIdx + ";" + numSubmissions + ";" + numCorrect + ";"
                                            + numShots + ";" + numRanges + ";" + numVideos + "\n";
                                }

                                // socket.respond(callback, true, csv);
                                ExportSocket.saveAndRespond(csv, "avsStatistics", socket, callback);

                            });
                        });
                    });
                });
            });
        });

        socket.on("exportSvgSubmissions", (data, callback) => 
        {
            // let svg = '<?xml version="1.0" encoding="UTF-8"?>\
            // <!DOCTYPE svg >\
            // <svg enable-background="new 0 0 2521.514 1658.161" version="1.1" viewBox="0 0 2521.514 1658.161" xml:space="preserve" xmlns="http://www.w3.org/2000/svg">\
            // <style type="text/css">\
            //     .st0{fill:#020202;}\
            // </style>\
            // <path class="st0" d="m1394.6 49.557c32.681 4.357 80.865-49.503 110.43 1.898 11.946 13.937-4.167 33.57 7.548 47.693 7.408 15.558 26.439 13.382 39.867 19.864 18.151 9.539 26.625 29.171 38.663 44.683 11.067 13.613 5.695 32.088 6.853 48.11 26.023 17.225 45.887 41.951 63.344 67.511 118.6-10.678 85.958 11.567 129.6-40.284 5.742 1.482 11.715 2.964 17.642 4.214 3.334-15.512 3.149-31.579-7.455-44.313 31.635 3.371 35.39 56.129 31.996 85.847-16.947 25.837-48.85 31.116-72.743 47.786-14.4 10.233-32.783 7.131-49.267 6.946-53.546 42.896 42.303 55.185 31.44 114.69-1.852 8.474-9.631 13.243-16.531 17.41-0.685-35.07-42.285-43.928-40.794-18.012 3.584 41.525 19.827 48.179 24.263 76.355-6.344 1.806-12.641 3.658-18.846 5.557-16.855-7.131-21.577-26.115-34.126-37.46-16.345-10.604-29.125 16.253-17.966 27.597 44.868 42.044 100.65 64.797 125.81 85.245 23.198 20.79 39.543 47.647 59.269 71.539 10.603 11.668 0.093 30.931 12.734 41.997 10.604 8.011 24.402 9.816 36.672 14.447 14.586 3.982 27.875 11.668 42.275 16.253 19.448 0.787 38.293-13.197 57.602-5.464 9.214 3.658 17.688 9.029 26.764 13.243 8.937-3.89 18.059-7.548 27.18-11.206-1.111-14.215 3.75-29.542-3.658-42.646-12.456-25.282-26.578-51.305-28.338-79.967 11.858-104.43 42.285-56.467 65.01-119.83-17.512-48.758 13.419-52.953 15.79-70.197 1.945-9.863 4.445-19.957 12.456-26.81 6.899 9.353 11.622 19.957 15.697 30.792 18.846-2.639 33.431 11.067 51.258 13.984 1.852 15.373-8.427 26.856-17.688 37.599 8.242 16.716 18.568 32.829 22.411 51.305 6.205 22.133-13.428 42.322-6.853 64.501 31.774 105.67 27.87 51.522 47.276 71.632 23.397-9.835 233.4-95.617 252.12-101.22 12.641-5.834 30.56 7.779 23.337 21.855-13.715 12.988-400.86 165.27-405.53 167.11 50.036 8.951 80.805-23.314 106.87-19.494-33.941 30.653-86.125 50.656-129.93 29.634-7.779 2.824-15.512 5.788-23.198 8.752 2.315 5.973 4.584 11.946 6.992 17.966-33.14 32.834-24.397 31.102-62.603 31.44-12.826 1.25-20.976-10.604-31.209-16.206 1.528 6.112 3.241 12.27 4.955 18.383-7.455 0.926-14.864 1.945-22.226 3.01-7.64 15.651-24.587 21.994-39.358 28.801-16.391 7.223-29.958-17.132-46.165-6.853-43.202 17.225-86.588 33.987-129.51 51.999 19.411 77.753-56.606 100.04-90.848 139.61-11.622 12.826-15.327 30.329-24.68 44.544-35.316 54.643-61.371 65.872-55.009 115.94 2.269 19.957 0.093 40.192 3.612 60.056 65.668 1.19 61.417 73.623 114.65 62.788 7.594-3.982 5.417-14.262 8.01-20.929 11.113 15.095 9.539 40.006-7.964 49.545-22.457 7.27-45.748-0.833-68.205-3.658-21.3-0.324-29.31-27.597-50.795-27.18-14.91-0.417-23.152 14.864-26.393 27.458-11.9-4.445-23.615-9.261-34.867-15.095 2.964-19.401-10.187-36.163-11.02-55.333-9.747-30.533 40.928-31.774 16.531-64.872-4.63-6.714-13.938-4.353-20.744-5.927-16.438 10.141-14.076 33.431-30.283 43.896-40.03 29.546-59.602 9.696-74.781 78.901 1.019 19.864 20.096 32.644 24.911 51.397 5.186 20.976 16.577 40.006 30.607 56.259 13.891 6.807 32.875-1.574 30.699-18.984 1.806 2.269 5.417 6.76 7.223 9.029 0.412 29.662-4.691 44.813-56.491 43.618-55.523-12.937-62.667-72.22-87.931-83.069-9.446 0.37-15.789 8.474-22.689 13.798-7.223-5.371-14.4-10.742-21.577-16.021 2.362-5.417 4.769-10.835 7.27-16.16-2.037-11.669-5.603-26.393 6.483-34.079 7.825-9.585 26.393-14.586 23.847-29.495-33.2-5.742-69.965 0.185-97.516 20.142-15.651 11.02-6.529 33.2-17.364 46.998-33.01 42.72-23.999 56.903-77.281 63.668 51.545-29.704 30.639-43.377 23.939-52.092 6.112-14.956 17.919-28.662 16.762-45.609-5.807-63.649 65.103-63.76 64.177-100.57-15.234 2.824-32.135 2.454-45.424 11.113-59.061 68.65-88.681 54.036-132.52 75.244-20.142 8.798-38.247 24.032-61.075 24.911-35.33 0.973-69.456-9.909-104.32-13.752 9.77-0.88 19.633-1.25 29.542-1.713 19.772-16.669 44.729-32.042 48.434-60.102-17.688-15.558-43.803-22.55-51.397-47.322-70.984 28.569-142.01 57-213.09 85.292-9.168 23.198-15.141 55.379-43.433 62.186-13.428 5.186-22.133-9.076-29.866-17.318-7.085 3.149-14.076 6.251-21.161 9.307-0.232 12.456 3.473 24.495 7.223 36.302-6.112 15.327-2.222 34.635-14.725 47.091-19.818 19.54-49.73 20.281-72.743 34.404-22.967 11.113-38.988 31.394-57.093 48.619-31.162 25.652-73.762 21.994-111.41 25.606-49.92 0.88-57.273 34.709-143.68 46.535-27.69 3.241-55.379 7.872-83.393 6.668 2.639-2.5 7.964-7.501 10.604-10.002-15.419-3.241-31.024-1.76-46.489-0.231-0.046-1.111-0.185-3.334-0.231-4.445 30.699-3.797 56.907-22.133 80.476-40.933-8.15 2.13-39.821 15.141-16.021-4.491-17.271-5.464-35.052-1.667-52.508 0.185 17.132-9.122 38.525-14.817 48.249-33.246-12.039 4.538-23.337 10.696-35.237 15.512 14.169-13.104 31.301-22.55 44.868-36.395-28.523 9.955-55.565 23.569-83.115 35.746 20.466-18.753 45.563-32.598 63.668-54.268-17.873-5.001-36.024 2.362-54.037-1.389 16.253-11.483 36.117-18.846 48.295-35.237-9.029 4.908-17.734 10.835-28.014 12.641 5.834-7.594 12.132-14.91 17.41-22.921-20.605 7.964-40.794 17.179-60.565 27.088 46.883-60.533 43.313-48.522 86.727-68.669 25.564-10.08 99.78-61.162 143.03-69.363 33.987-7.085 68.113-13.474 102.15-20.142 27.134-4.445 50.703-21.3 78.392-23.337 70.136-5.279 69.96 13.437 100.57 25.328 0.509 3.149 1.574 9.446 2.084 12.594 6.853-2.084 14.123-3.426 20.374-7.177 7.64-9.029 6.76-22.411 13.706-31.857 25.838-14.724 54.361-1.343 79.503 7.64 66.4-27.829 133.49-53.898 199.99-81.634-72.901-74.498-90.172-57.315-137.43-87.375 130.45 4.283 74.044 20.911 145.21-19.818 21.855-12.363 45.933-20.05 68.344-31.348-28.847 4.677-55.935 16.993-85.106 20.003-15.002 0.509-28.199 7.825-42.09 12.271-15.466 2.732-30.838-2.13-46.026-4.121-27.319-5.742-54.638 18.846-81.263 4.63-43.062-20.42-87.607-37.228-133.31-50.656 85.315 9.756 178.56 52.55 246.34 0 74.822-52.388 132.98-31.663 182.34-39.914 48.059-4.436 145.22 34.112 190.08 31.533-1.343-2.176-3.982-6.436-5.325-8.566-59.116-45.702-127.43-54.768-91.496-131.09 9.261-16.345 26.023-25.884 41.303-35.747-62.191-2.69-62.32 17.924-88.718 18.105-162.24 15.632-51.351 68.492-250.87-11.993 50.86 10.451 144.24 34.862 162.39 12.178 65.478-77.596 176.92-59.088 219.53-148.03-14.539-7.547-8.566-28.431-21.763-35.978-42.97-8.937-89.366 0.602-131.04-16.484-77.948-22.828-67.872-51.36-135.9-37.367 27.291-25.342 154.76-24.319 170.17-25.004 68.867-0.81 79.17 35.552 167.3-23.893-18.29-2.13-37.043 0.324-54.87-4.862-104.04-26.18-84.921-26.384-126.13-48.11-28.199-6.668-56.259 5.325-84.227 8.057 35.746-20.605 79.967-33.987 120.3-18.938 120.89 44.442 193.32 17.359 223.69-18.707-23.985-7.594-45.887 5.557-68.669 10.557-29.542 0.88-58.991-3.056-88.255-6.807-20.281-2.593-40.655 1.019-60.936-0.37 77.837-18.262 142.57 16.28 228.09-27.227-26.393-5.325-51.999 7.594-78.299 4.445-16.855-6.575-33.431-15.095-52.092-14.725-32.459-0.139-65.01-3.704-97.377-0.417 58.635-33.297 152.1 2.172 182.67-19.17-23.615 2.269-46.721-3.38-69.317-9.539-37.237-55.231-84.796-21.332-115.57-69.27 152.44 11.608 78.323 59.977 198.88 61.352-13.706-10.881-30.236-14.725-47.369-14.308-28.986-18.475-47.415-50.795-55.333-83.717 11.854 14.91 17.04 34.265 31.07 47.739 11.437 13.706 29.958 16.299 45.239 23.8 10.604 4.538 21.855 11.483 33.894 7.918 38.224-10.469 86.935 9.613 112.24-33.663-23.522 2.084-49.082 9.353-70.845-3.612 40.933-33.848 94.784-45.609 144.88-59.454 17.734-5.186 14.215-27.643 17.827-41.812 6.112-25.004-16.114-41.442-29.727-58.621-14.354-13.66-13.428-35.006-18.661-52.786-11.511-40.789 17.683-32.445-30.468-92.885-11.993-9.122-26.949 5.279-39.729-0.648-20.79-10.372-46.489-21.994-51.258-47.415 7.686-9.029 19.216 4.769 27.042 8.659 17.88-4.072 35.985-8.656 54.506-7.128m-427.85 606.07c18.846 3.149 38.062 4.028 56.676 8.566 15.789 3.709 44.1 24.152 95.849 7.27-45.073 0.143-74.115-34.617-152.52-15.836m1166 44.775c8.335-1.435 16.855-1.852 25.421-1.482-7.038-6.39-13.614-13.243-19.726-20.466-0.463 7.64-2.315 15.049-5.695 21.948m-465.35 113.54c-18.059 8.983-38.849 9.631-58.528 8.427 2.176-7.872 5.001-15.465 7.964-23.013 4.121-6.946-5.093-11.159-10.603-10.094-71.549 3.89-66.83 26.476-68.9 43.016 5.51 4.353 10.881 10.326 18.707 9.307 97.65 1.783 95.58-0.06 133.68 46.118 41.534-14.863 81.634-33.385 122.94-48.897 10.974-3.519 19.355-11.391 26.81-19.864-12.085 1.25-27.273 5.001-36.395-5.464-14.817-16.762-34.774-27.319-52.138-40.979-28.107 13.29-55.657 27.645-83.532 41.443m-693.72 492.53c44.725-34.755 96.668 2.236 149.93-100.71-102.12 38.419-106.51 36.386-149.93 100.71z"/>\
            // </svg>';


            // Create new SVG Builder
            let svg = svgBuilder.newInstance();


            // Find correct competition
            db.findCompetition({_id: data.competitionId}, (competition) => 
            {
                // Find submissions for this competition
                db.findSubmissions({competitionId: data.competitionId}, (submissions) => 
                {
                    // Find teams in this competition
                    db.findTeams({competitionId: data.competitionId}, (teams) => 
                    {
                        // Create team map variable
                        var teamMap = {};
                        for (var i = 0; i < teams.length; i++) {
                            teamMap[teams[i]._id] = teams[i];
                        }

                        // Find tasks for this
                        db.findTasks({competitionId: data.competitionId}, (tasks) => // load all tasks of this competition
                        {   
                            const topPadding = 30;
                            const rightPadding = 30;   
                            const bottomPadding = 30;
                            const leftPadding = 30;
                            
                            // Set dimensions based on number of tasks
                            const subColWidth = 20;
                            svg.width(leftPadding + subColWidth * competition.taskSequence.length + rightPadding).height(480);

                            for (var i = 0; i < competition.taskSequence.length; i++) // proceed in the order of task execution
                            {     
                                var taskId = competition.taskSequence[i];
                                var taskIdx = i + 1;
                                var task = tasks.find((t) => t._id == taskId);

                                // If task has already finished
                                if (task.finished) 
                                {
                                    // Get submissions with this task ID only
                                    var sub = submissions.filter((s) => s.taskId == taskId);

                                    // Sort them chronologically
                                    sub.sort((a, b) => a.searchTime - b.searchTime);

                                    const leftOffset = leftPadding + ((subColWidth * i) - (subColWidth / 2));

                                    svg.line({
                                        x1:leftOffset,
                                        y1:0,
                                        x2:leftOffset,
                                        y2:480,
                                        stroke:'#aaaaaa',
                                        'stroke-width': 2
                                    });
                                    

                                    // Iterate through them
                                    for (var j = 0; j < sub.length; j++) 
                                    {
                                        


                                        var s = sub[j];
                                        // csv += taskIdx + ";" + task.type + ";" + (task.type.includes("novice") ? "novice" : "expert") + ";"
                                        //         + s.teamNumber + ";" + teamMap[s.teamId].name + ";" + s.memberNumber + ";"
                                        //         + s.videoNumber + ";" + s.shotNumber + ";" + s.frameNumber + ";"
                                        //         + s.searchTime + ";" + s.judged + ";" + s.correct + "\n";
                                    }
                                }
                            }

                            // Render final SVG
                            const svgXml = svg.render();

                            // Save this file and resolve request
                            ExportSocket.saveAndRespondSvg(svgXml, "submissions", socket, callback);
                        });
                    });
                });
            });
        });
    }

    static saveAndRespondSvg(svg, label, socket, callback) {
        var fileName = uniqueFilename(exportPath, label) + ".svg";
        fs.writeFileSync(fileName, svg);
        socket.respond(callback, true, exportDir + "/" + path.parse(fileName).base);
    }

    static saveAndRespond(csv, label, socket, callback) {
        var fileName = uniqueFilename(exportPath, label) + ".csv";
        fs.writeFileSync(fileName, csv);
        socket.respond(callback, true, exportDir + "/" + path.parse(fileName).base);
    }

    exportResultsCsv(competitionId, year) {

        // export groundtruth
        var str3 = "trecvidId;videoNumber;shotNumber;correct;judge\n"
        this.db.findEntity(this.db.db.groundTruth, {}, (groundTruth) => {
            for (var i = 0; i < groundTruth.length; i++) {
                var gt = groundTruth[i];
                str3 += gt.trecvidId + ";" + gt.videoNumber + ";" + gt.shotNumber + ";" + gt.correct + ";" + gt.judge + "\n";
            }
            fs.writeFileSync("export_groundtruth.csv", str3);
            console.log("groundtruth export successful");
        }, () => {
        }, true);

    }
}

module.exports = ExportSocket;
