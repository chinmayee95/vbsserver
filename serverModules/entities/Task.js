var Utils = require('../Utils.js');
var logger = require('winston');

class Task {

    constructor(data) {

        data = (data) ? data : {};

        this._id;   // generated by Database
        this.competitionId = data.competitionId;

        // properties for all task types              
        this.name = data.name;
        this.maxSearchTime = data.maxSearchTime; // in seconds

        this.running = false;
        this.finished = false;
        this.startTimeStamp = null;
        this.endTimeStamp = null;

        // query is different for different task types and may contain different fields
        this.type = data.type;  // currently supported types: KIS_Visual, KIS_Textual, AVS, KIS_Visual_novice, KIS_Textual_novice, AVS_novice

        // KIS tasks
        this.videoRanges = data.videoRanges;    // KIS: array of {videoId, videoNumber, startFrame, endFrame} (to support duplicates)
        this.textList = data.textList;          // KIS_Textual: array of {delay, text}, textual descriptions (for refining the query)

        // AVS tasks
        this.trecvidId = data.trecvidId;
        this.avsText = data.avsText;

    }

    static start(task) {
        logger.info("starting task", {taskName: task.name, taskType: task.type});
        logger.verbose("starting task", task);
        task.startTimeStamp = Date.now();
        task.endTimeStamp = null;
        task.running = true;
        task.finished = false;
    }

    static stop(task) {
        logger.info("stopping task", {taskName: task.name, taskType: task.type});
        logger.verbose("stopping task", task);        
        task.endTimeStamp = Date.now();
        task.running = false;
        task.finished = true;
    }

    static getRemainingTime(task) {
        if (task) {
            return Utils.roundSeconds(task.maxSearchTime - (Date.now() - task.startTimeStamp) / 1000);
        } else {
            return NaN;
        }
    }

}

module.exports = Task;
