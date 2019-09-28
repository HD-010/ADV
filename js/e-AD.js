/**
 * 配置文件
 */
var conf = {
	httpHost: "http://192.168.0.114:3005",
	wsHost: "ws://192.168.0.114:3005",
}

/**
 * 系统服务
 */
var server = {
	host: conf.httpHost,
	initTimes: 0,			//系统初始化次数
	status: 0,				//系统状态 0 没有运行 1 正常运行
	init: function(data){
		server.initTimes ++;
		app.notice({error:1, message:"正在进行第"+server.initTimes+"次初始化服务..."});
		DL({
			uri: server.host + '/api/device/reg',
			data: data,
			befor: function(me) {
				server.status = 1;
				//console.log(JSON.stringify(me.results));
				var res = me.results;
				if (res.error) return;
				//将客户端id储存起来
				setItem('unid', res.data.id);
				//eval("(process = " + res.data.process + ")");
				//初始化webSocket
				ws.initWs();
				me.exit();
			},
			error: function(){
				if(!server.status) server.init(data);
			}
		});
	}
}

/**
 * webSocket对象 
 */
var ws = {
	state: false,
	host: conf.wsHost,
	protocol: 'echo-protocol',
	connection: null,
	rebuildTime: 60000,		//得建ws连接时间
	//初始化webSocket服务
	initWs: function() {
		//创建webSocket连接
		ws.connection = new WebSocket(ws.host, ws.protocol);
		ws.connection.onopen = function() {
			//连接成功提示信息
			app.notice({
				error: 0,
				message: 'ws连接成功'
			})
			ws.send = function(obj) {
				ws.connection.send(JSON.stringify(obj));
			}
			//请求播放任务
			ws.send({
				action: '/api/task/list',
				data: {unid: getItem('unid')}
			});
		};
		ws.connection.onmessage = ws.onMsg;
		ws.connection.onclose = ws.onClo;
		ws.connection.onerror = ws.onErr;
	},
	//收到消息的处理方法
	onMsg: function(msg){
		msg = msg.data;
		//业务逻辑信息处理.处理方法写到process对象
		if (msg.error) return app.notice(msg);
		msg = JSON.parse(msg);
		//储存持久任务列表
		process.storTask(msg);
		if (msg.type in process){
			//设置当前任务属性
			process.persistent = msg.persistent;
			//执行插播任务
			if(!msg.persistent) return process[msg.type](msg);
			//循环执行播放列表任务
			if(msg.persistent) return process[msg.type]();
		}
		app.notice({
			error: 1,
			message: "没有" + msg.type + "任务的处理机制！"
		});
	},
	//服务关闭的处理方法
	onClo: function(clo){
		//自动重建ws连接
		ws.rebuildWs();
	},
	//服务出错的处理方法
	onErr: function(err) {
		//尝试重新发送信息1次。如果还是错误,反馈到设备列表状态
		ws.rebuildWs();
		ws.sned({
			action: '/api/device/err',
			data: {
				error:1,
				unid: getItem('unid'),
				message:err
			}
		});
	},
	//重建ws服务
	rebuildWs: function(){
		var rebuildWs = setInterval(function(){
			if(ws.connection) return clearInterval(rebuildWs)
			ws.initWs();
		},ws.rebuildTime)
	}
};

//视图容器
var views = {
	video: '<div class="video-box" id="video"></div>',
	img: '<div class="img-box"><img src="" /></div>',
	notice: '<div class="notice-box">' +
		'<i class="icon-notice"></i>' +
		'<marquee class="noticeText" direction="left" behavior="" scrollamount="1" scrolldelay="50" loop="0" width="100%" onmouseover="this.stop();" onmouseout="this.start();"  style="width: 100%;"></marquee>' +
		'</div>'
}

/**
 * 视频播放器控制对象
 */
var player = {
	self: null,	  //video对象
	state: false, //当前播放状态
	/**
	 * 实例化播放器
	 */
	init: function() {
		player.self = new plus.video.VideoPlayer('video', {
			src: "",
			loop: true,
			autoplay: true,
			objectFit: "cover"
		});
		//监听播放事件
		player.self.addEventListener('play', function() {
			//updatePlaying(true);
		}, false);
		
		//监听暂停事件
		player.self.addEventListener('pause', function() {
			//updatePlaying(false);
		}, false);
		
		/**
		 * 视频播放进度更新事件
		 * @param {Object} o
		 * 当视频播放进度变化时触发，触发频率250ms一次。 
		 * 事件回调函数参数event.detail = {
				 currentTime:"Number类型，当前播放时间（单位为秒）",
				 duration:"Number类型，视频总长度（单位为秒）"
			}。
		 */
		player.self.addEventListener("timeupdate", function(e){
			return;
			e.eventType = "timeupdate";
			ws.send({
				action:'/api/device/ent',
				unid: getItem('unid'),
				data: e
			});
		});
		
		/**
		 * 视频缓冲事件
		 * (String 类型 )当视频播放出现缓冲时触发。 无事件回调函数参数。
		 */
		player.self.addEventListener("waiting", function(e){
			return;
			e.eventType = "waiting";
			ws.send({
				action:'/api/device/ent',
				unid: getItem('unid'),
				data: e
			});
		});
		
		/**
		 * 视频错误事件
		 * (String 类型 )当视频播放出错时触发。 无事件回调函数参数。
		 */
		player.self.addEventListener("error", function(e){
			return;
			e.eventType = "error";
			ws.send({
				action:'/api/device/ent',
				unid: getItem('unid'),
				data: e
			});
		});
		
		return player;
	}
}

/**
 * 业务逻辑处理器
 */
var process = {
	//所有任务主体，访问任务主体：$(process.tasks['t1'])。 't1' 为 'taskTag'
	tasks:{},  
	
	/**
	 * 暂存数据
	 * 被暂存的数据需要有 persistent = true 标识
	 */
	storTask: function(data){
		//alert(JSON.stringify(data));
		if(!data.persistent) return;
		setItem("task_list", data);
	},
	
	/**
	 * 读有效的任务列表
	 */
	readTask: function(){
		var taskList = getItem('task_list') || {};
		return taskList.list;
		
	},

	/**
	 * 处理任务列表的方法
	 * 接收到任务时，把任务列表储存起来，供后续调用（如执行插播任务后再次调用任务列表）
	 * @param {Object} data
	 */
	task_list: function(data) {
		//任务主体
		var task;	
		data = data || process.readTask(); //优先执行插播任务的任务列表
		if(!data){
			setTimeout(function(){
				app.notice({error: 1, message:"播放任务为空！"});
			}, 3000)
			return;
		} 
		$("#contents").html('');
		for (var i = 0; i < data.length; i++) {
			if (!data[i].enable) continue;
			!data[i].type in process
			eval(('var typeFunc = ' + data[i].type))
			if(typeof typeFunc != 'function') continue;
			//将任务内容装到任务主体
			task = $(views[data[i].type])[0].outerHTML;
			//加载附加样式
			task= $(task).attr('data-tag', data[i].taskTag); 
			if(data[i].style) task.css(data[i].style);
			//将任务主体索引到任务主体对象列表
			$("#contents").append(task);
			//实现媒体功能
			process.tasks[data[i].taskTg] = new typeFunc();
			process.tasks[data[i].taskTg].lists = data[i];
			process.tasks[data[i].taskTg].play();
		}  
	}
};

/**
 * 消息任务执行成员
 */
function notice(){
	var me = this;
	this.lists ={};
	//节目序号
	this.num = 0;
	
	this.play = function(){
		var obj = this.lists;
		//视频播放列表
		var title = obj.list[this.num].title;
		var content = obj.list[this.num].content;
		$('[data-tag=' + obj.taskTag + ']').find('.icon-notice').html(title);
		$('[data-tag=' + obj.taskTag + ']').find('.noticeText').html(content);
		setTimeout(function(){
			me.play(obj);
		},obj.list[this.num].duration * 1000);
		if(this.num == obj.list.length-1){
			//如果当前执行的不是循环任务列表，则重新执行循环任务列表的任务
			if(!process.persistent) return process.task_list();
			return this.num = 0;
		}
		this.num ++;
	}
}

/**
 * 视频任务执行成员
 */
function video(){
	var me = this;
	player.init();
	this.lists = {};
	//节目序号
	this.num = 0;
	//播放列表
	this.play = function() {
		//视频播放列表
		var obj = this.lists;
		var url = obj.list[this.num].url;
		if (url && url.length > 0) {
			if (!url.match(/(http:)|(https:)/)) url = server.host + url;
			player.self.setOptions({
				src: url
			});
			player.self.play();
		}
		setTimeout(function(){
			me.play(obj);
		},obj.list[this.num].duration * 1000);
		if(this.num == obj.list.length-1){
			//如果当前执行的不是循环任务列表，则重新执行循环任务列表的任务
			if(!process.persistent) return process.task_list();
			return this.num = 0;
		} 
		this.num ++;
	}
}

/**
 * 图片任务执行成员
 */
function img(){
	var me = this;
	this.lists = {};
	//节目序号
	this.num = 0;
	this.play = function(){
		var obj = this.lists;
		//视频播放列表
		var url = obj.list[this.num].url;
		if (url && url.length > 0) {
			if (!url.match(/(http:)|(https:)/)) url = server.host + url;
			$('[data-tag=' + obj.taskTag + ']').find('img').attr('src',url);
		}
		setTimeout(function(){
			me.play(obj);
		},obj.list[me.num].duration * 1000);
		if(this.num == obj.list.length-1){
			//如果当前执行的不是循环任务列表，则重新执行循环任务列表的任务
			if(!process.persistent) return process.task_list();
			return this.num = 0;
		} 
		this.num ++;
	}
}

/**
 * H5 plus事件处理
 */ 
function plusReady() {
	//创建服务器连接
	//流程:客户端启动完成->拿客户端标识到服务端注册->服务器返回注册完成后的客户端对应的数据表id号->
	//客户端以unid(数据表id)为基准与webSocket服务器建立连接->获取播放任务列表->执行任务->
	//在任务执行节点处将执行结果反馈webSocket服务器->webSocket服务将信息体现在设备状态列表
	var data = {
		device_model: plus.device.model,
		device_vendor: plus.device.vendor,
		device_imei: plus.device.imei,
		device_uuid: plus.device.uuid
	};
	data.device_sn = $.md5(Object.values(data).join(''));
	server.init(data);
}
























// 播放
function playVideo1() {
	var path = document.getElementById('path1').value;
	if (path && path.length > 0) {
		video.setOptions({
			src: path
		});
		video.play();
	}
}

// 播放/暂停
function ppVideo() {
	playing ? video.pause() : video.play();
}
// 全屏
function fullscreenVideo() {
	video.requestFullScreen(-90);
}
// 创建子创建覆盖在视频控件上
var wsub = null;

function createSubview() {
	if (!wsub) {
		var topoffset = document.getElementById('video').offsetTop;
		wsub = plus.webview.create('video_videoplayer_sub.html', 'sub', {
			top: topoffset,
			height: '300px',
			position: 'static',
			scrollIndicator: 'none',
			background: 'transparent'
		});
		plus.webview.currentWebview().append(wsub);
	}
	wsub.isVisible() ? wsub.hide() : wsub.show();
}




