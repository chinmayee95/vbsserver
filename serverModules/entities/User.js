class User {
    constructor(data) {
        
        data = (data) ? data : {};
        
        this._id;   // generated by Database
        this.username = data.username;
        this.password = data.password;   // TODO hash
        this.role = data.role;   // supported roles: admin, viewer, judge
    }
}

module.exports = User;
