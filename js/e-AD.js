/**
 * 配置文件
 */
var conf = {
	httpHost: "http://192.168.1.102:3005",
	wsHost: "ws://192.168.1.102:3005",
	macid: 1,
	promotionalPath: "_www/video/company/promotional/01.mp4", //宣传片路径
	promotionalDuration: 10,		//宣传片播放时长
	nullDataWait: 60,				//零资源等待时间
	downloadOption: {
		method: 'GET',
		data: '',
		filename: "_documents/",
		priority: 0,
		timeout: 120,
		retry: 130,
		retryInterval: 130
	},
	taskManage: {
		//srcRoot: "_www/e-AD/",							//开发测试时数据包存放的位置
		//srcRoot: "/storage/emulated/0/e-AD/",				//虚拟机测试时数据包存放的位置
		srcRoot: "/mnt/usb_storage/USB_DISK1/udisk0/e-AD",	//u盘数据包存放的位置
		targetRoot: "_documents/"							//任务数据存放的位置
	}
}

/**
 * 系统服务
 */
var server = {
	host: conf.httpHost,
	initTimes: 0, //系统初始化次数
	status: 0, //系统状态 0 没有运行 1 正常运行
	init: function(data) {
		server.initTimes++;
		app.notice({
			error: 1,
			message: "正在进行第" + server.initTimes + "次初始化服务..."
		});
		DL({
			uri: server.host + '/api/device/reg',
			data: data,
			timeout: 20000,
			befor: function(me) {
				var res = me.results;
				if (!res || res.error || !res.data) {
					me.exit();
					return err();
				}
				server.status = 1;
				//将客户端id储存起来
				setItem('unid', res.data.id);
				//eval("(process = " + res.data.process + ")");
				//初始化webSocket
				ws.initWs();
				me.exit();
			},
			error: err
		});
		
		function err(){
			try{
				//离线播放，则无限次尝试与服务器连接获取数据
				if (!server.status) server.init(data);
			}catch(e){}  
		}
	},
	
	localUrl: function(url){
		var localUrl = url.split('/');
		for (var i = 0; i < 3; i++) {
			localUrl.shift();
		}
		return localUrl.join('/');
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
	rebuildTime: 10000, //得建ws连接时间
	//初始化webSocket服务
	initWs: function() {
		if(ws.connection) return app.notice({error: 0, message: "ws已经连接。"});
		//创建webSocket连接
		ws.connection = new WebSocket(ws.host, ws.protocol);
		ws.connection.onopen = function() {
			//连接成功提示信息
			console.log("=====ws"+getItem('unid')+'ws连接成功')
			ws.send = function(obj) {
				ws.connection.send(JSON.stringify(obj));
			}
			//请求播放任务
			ws.send({ 
				action: '/api/task/list',
				data: {
					unid: getItem('unid')
				}
			});
		};
		ws.connection.onmessage = ws.onMsg;
		ws.connection.onclose = ws.onClo;
		ws.connection.onerror = ws.onErr;
	},
	//收到消息的处理方法
	onMsg: function(msg) {
		msg = msg.data;
		//console.log("============ONMESSAGE==========" + JSON.stringify(msg))
		//业务逻辑信息处理.处理方法写到process对象 
		if (msg.error) return app.notice(msg);
		msg = JSON.parse(msg);
		//储存持久任务列表
		process.storTask(msg);
		//下载任务初始化
		download.initTask(msg);
		//任务清单对象下载初始化
		//任务任务列表
		process.initTask(msg);
	},
	//服务关闭的处理方法
	onClo: function(clo) {
		console.log("=====wsws连接关闭");
		//自动重建ws连接
		ws.rebuildWs();
	},
	//服务出错的处理方法
	onErr: function(err) {
		console.log("=====ws连接错误，正在进行连接。。。");
		ws.rebuildWs();
	},
	//重建ws服务
	rebuildWs: function() {
		ws.connection = null;
		var rebuildWs = setInterval(function() {
			if (ws.connection) {
				console.log("=====ws重新连接成功");
				return clearInterval(rebuildWs)
			}
			ws.initWs();
		}, ws.rebuildTime)
	}
};

//视图容器
var views = {
	video: '<div class="video-box" id="video"></div>',
	img: '<div class="img-box"><img src="" /></div>',
	notice: '<div class="notice-box">' +
		'<i class="icon-notice"></i>' +
		'<marquee class="noticeText" direction="left" behavior="" scrollamount="1" scrolldelay="50" loop="0" width="100%" onmouseover="this.stop();" onmouseout="this.start();"  style="width: 100%;"></marquee>' +
		'</div>',
	blackmodel: '<div class="black-model"></div>',
	wActiv: '<img class="img-activ" src="img/w-activ.jpg" />',
	hActiv: '<img class="img-activ" src="img/h-activ.jpg" />',
	//系统初始化时加载的引导页
	init: function() {
		window.innerHeight > 1600 ?
			$("#contents").append(views.hActiv) :
			$("#contents").append(views.wActiv);
		$("#contents .img-activ").height(window.innerHeight);
	},
	//关机效果
	shutdown: function() {
		$("#contents").html(views.blackmodel)
	},
	//复制视图
	copying: function(){
		$("#contents").html("<b>正在传输数据， 请稍后...</b>")
	}
}

/**
 * 文件下载器
 */
var download = {
	task: [],
	//下载队列
	queue: [],
	//下载任务初始化
	initTask: function(msg){
		if(msg.error) return;
		if(!msg.persistent) return;
		if(msg.type != 'task_list') return;
		//获取列表中的所有url
		var url = treeValue(msg.list,'url', function(url){
			return url ? true : false;
		},'url', 'all');
		this.queue = unique(url);
		//console.log("==================所有需要下载的资源："+ JSON.stringify(this.queue));
		download.init();
	},
	// 创建下载任务
	// url ： 绝对路径（http://xxxx/filename）
	// 如： url = server.host + url
	// 调用： download.init(url);
	init: function() {
		//console.log("=============当前下载队列："+JSON.stringify(this.queue));
		var url = this.queue[0];
		if(!url.match(/(http:)|(https:)/)) url = server.host + url;
		var localUrl = server.localUrl(url);
		plus.io.resolveLocalFileSystemURL(conf.downloadOption.filename + localUrl, 
			function(entry) {
				//如果该文件存在，则下载下队列中的下一个文件
				//console.log("===="+conf.downloadOption.filename + localUrl+"文件存在");
				//弹出下载队列中的url
				download.queue.shift();
				//初始化队列中下一个url的下载任务
				if(download.queue.length) download.init();
			},
			function(e){
				//console.log("====正在下载："+conf.downloadOption.filename + localUrl);
				var option = {
					method: conf.downloadOption.method,
					data: conf.downloadOption.data,
					filename: conf.downloadOption.filename + server.localUrl(url),
					priority: conf.downloadOption.priority,
					timeout: conf.downloadOption.timeout,
					retry: conf.downloadOption.retry,
					retryInterval: conf.downloadOption.retryInterval
				}
				download.task = plus.downloader.createDownload(url, option);
				download.task.addEventListener("statechanged", download.stateChanged, false);
				download.task.start();
			}
		);
	},
	// 监听下载任务状态
	stateChanged: function(downloadObj, status) {
		//下载的文件太小53B，则不下载
		if(downloadObj.state == 3  && status == 200){
			//console.log("正在下载：" + downloadObj.filename + parseFloat(downloadObj.downloadedSize)/parseFloat(downloadObj.totalSize)*100 + '%' );
			if(downloadObj.totalSize < 100) downloadObj.abort();
		}
		// 下载完成, 清除缓存文件
		if (downloadObj.state == 4 && status == 200) {
			console.log("==============::" + downloadObj.filename + "下载完成");
			download.queue.shift();
			if(download.queue.length) download.init();
		}
	},
	// 暂停下载任务 
	pause: function() {
		download.task.pause();
	},
	// 取消下载任务 
	abort: function() {
		download.task.abort();
	},
	// 恢复下载任务
	resume: function() {
		download.task.resume();
	},
	// 开始所有下载任务
	startAll: function() {
		plus.downloader.startAll();
	}
}


/**
 * 视频播放器控制对象
 */
var player = {
	self: null, //video对象
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
		player.self.addEventListener("timeupdate", function(e) {
			return;
			e.eventType = "timeupdate";
			ws.send({
				action: '/api/device/ent',
				unid: getItem('unid'),
				data: e
			});
		});

		/**
		 * 视频缓冲事件
		 * (String 类型 )当视频播放出现缓冲时触发。 无事件回调函数参数。
		 */
		player.self.addEventListener("waiting", function(e) {
			return;
			e.eventType = "waiting";
			ws.send({
				action: '/api/device/ent',
				unid: getItem('unid'),
				data: e
			});
		});

		/**
		 * 视频错误事件
		 * (String 类型 )当视频播放出错时触发。 无事件回调函数参数。
		 */
		player.self.addEventListener("error", function(e) {
			return;
			e.eventType = "error";
			ws.send({
				action: '/api/device/ent',
				unid: getItem('unid'),
				data: e
			});
		});

		return player;
	},
	
	distruct: function(){
		if(player.self) player.self.close();
	}
}

/**
 * 业务逻辑处理器
 */
var process = {
	//所有任务主体，访问任务主体：$(process.tasks['t1'])。 't1' 为 'taskTag'
	tasks: {},
	//定时任务
	timeout:[],
	//任务控制状态 有停止状态stop， 播放状态play(默认)
	state: '',
	//任务类型
	type: [],
	/**
	 * 播放任务初始化
	 */
	initTask: function(msg){
		if (msg.type in process) {
			//设置当前任务属性
			process.persistent = msg.persistent;
			
		    msg.persistent ? 
			//循环执行列表任务
			process[msg.type]():
			//执行一次性任务
			process[msg.type](msg);
			return true;
		}
		app.notice({
			error: 1,
			message: "没有" + msg.type + "任务的处理机制！"
		});
	},

	//设置媒体类型
	setType: function(type){
		this.type.push(type);
		this.type = unique(this.type);
	},
	
	/**
	 * 暂存数据
	 * 被暂存的数据需要有 persistent = true 标识
	 */
	storTask: function(data) {
		//alert(JSON.stringify(data));
		if (!data.persistent) return;
		var task_list = getItem("task_list") || [];
		task_list.push(data);
		setItem("task_list", task_list);
	},

	/**
	 * 读有效的任务列表
	 */
	readTask: function() {
		//清除无效任务
		process.clearTask();
		var taskList = getItem("task_list") || [];
		//取出当前时间在有效期的任务（逆序）
		//备用任务表
		var reserveTask, 
		//正式任务表
		officialTask;
		var currentTime = (new Date()).valueOf();
		for(var i = taskList.length - 1; i > -1; i --){
			var endTime = taskList[i].endTime,
			startTime = taskList[i].startTime,
			playStart = currentTime.toLocaleDateString + ' ' + taskList[i].playStart;
			playDone = currentTime.toLocaleDateString + ' ' + taskList[i].playDone;
			if(!reserveTask){
				//如果有多个备用任务表，取最后一个
				if(!endTime) reserveTask = taskList[i];
			}
			if(!officialTask) {
				startTime = (new Date(startTime)).valueOf();
				endTime = (new Date(endTime)).valueOf();
				playStart =  (new Date(playStart)).valueOf();
				playDone =  (new Date(playDone)).valueOf();
				if(((currentTime >= startTime) && (currentTime < endTime)) &&
					((currentTime >= playStart) && (currentTime < playDone))
				) {
				//if((currentTime >= startTime) && (currentTime < endTime)) {
					//如果有多个有效任务表，取最后一个
					officialTask = taskList[i];
				}
			}
		}
		
		taskList = officialTask || reserveTask;		//执行最后一次下发的任务
		//return taskList.list;
		return taskList;
	},
	
	/**
	 * 删除过期的任务
	 */
	clearTask: function(){
		var taskList = getItem("task_list");
		if(!taskList) return;
		var currentTime = (new Date()).valueOf();
		//备用任务个数
		var reserveTask = array2value(taskList,'endTime', '0', 'all');
		reserveTask = reserveTask ? reserveTask.length : 0;
		for(var i = 0; i > taskList.length; i ++){
			var endTime = taskList[i].endTime;
			//保留最后一次下发的永久循环任务endTime： 0
			if(reserveTask > 1){
				taskList.splice(i, 1);
				reserveTask --;
			}
			endTime = (new Date(endTime)).valueOf();
			if(currentTime > endTime) taskList.splice(i, 1);
		}
		setItem("task_list", taskList);
	},

	/**
	 * 处理任务列表的方法
	 * 接收到任务时，把任务列表储存起来，供后续调用（如执行插播任务后再次调用任务列表）
	 * @param {Object} data
	 */
	task_list: function(data) {
		data = data || process.readTask(); //优先执行插播任务的任务列表
		if (!data.list.length) {
			return app.notice({
				error: 1,
				message: "播放任务为空！"
			});
		}
		//当前任务主体
		var task,lists;
		//初始化任务列表
		process.tasks = {};
		//销毁之前的播放器对象
		player.distruct();
		//初始化定时器
		process.clearTimeout();
		$("#contents").html('');
		//设备任务为播放状态
		process.state = "play";
		lists = data.list;
		for (var i = 0; i < lists.length; i++) {
			if (!lists[i].enable) continue;
			if(!lists[i].type in process) continue;
			eval(('var typeFunc = ' + lists[i].type));    //引用函数img|notice|video
			if (typeof typeFunc != 'function') continue;
			//将任务内容装到任务主体
			task = $(views[lists[i].type])[0].outerHTML;
			//加载附加样式
			task = $(task).attr('data-tag', lists[i].taskTag);
			if (lists[i].style) task.css(lists[i].style);
			//将任务主体索引到任务主体对象列表
			$("#contents").append(task);
			//实现媒体功能
			process.setType(lists[i].type);
			process.tasks[lists[i].taskTag] = new typeFunc();
			process.tasks[lists[i].taskTag].lists = lists[i];
			process.tasks[lists[i].taskTag].persistent = data.persistent;
			process.tasks[lists[i].taskTag].play();
		}
	},

	/**
	 * 停止屏幕播放
	 */
	oper_stop: function() {
		//设置任务状态，后续任务依据该状态执行
		process.state = 'stop';
		//及时同步播放器改变状态
		player.self.stop(); 
	},
	/**
	 * 恢复屏幕播放
	 */
	oper_play: function() {
		//设置任务状态，后续任务依据该状态执行
		process.state = 'play';
		//启动播放任务
		process.task_list();
	},
	
	//清空之前的定时任务
	clearTimeout: function(){
		for(var i in process.timeout){
			clearTimeout(process.timeout[i]);
			process.timeout.remove(process.timeout[i]);
		}
	},
	
	//具备离线播放条件的情况下启动进入离线播放,
	//在连接服务器成功并获取数据后，执行指定任务
	offlinePlay: function(){
		if(process.readTask() && !process.state) {
			process.state = 'play';
			//设置当前任务属性
			process.persistent = false;
			process.task_list();
		}
	},
	
	//切换任务列表
	//implement 执行对象
	//type 任务类型
	cutoverTask: function(implement, type){
		if(!(process.type.indexOf(type) + 1)){
			if (implement.num < implement.lists.list.length) {
				if(process.state == 'play') implement.play();
			}else{
				if(!process.persistent) process.task_list();
			}
		}
	}
};

/**
 * 消息任务执行成员
 */
var notice = function() {
	//console.log("===========type:" +JSON.stringify(process.type));
	var me = this;
	this.lists = {};
	//节目序号
	this.num = 0;
	this.play = function() {
		var obj = me.lists;
		//视频播放列表
		var title = obj.list[me.num].title;
		var content = obj.list[me.num].content;
		$('[data-tag=' + obj.taskTag + ']').find('.icon-notice').html(title);
		$('[data-tag=' + obj.taskTag + ']').find('.noticeText').html(content);
		var noticeTimer = setTimeout(function() {
			clearTimeout(noticeTimer);
			process.timeout.remove(noticeTimer,1)
			//如果没有视频，则由notice决定切换任务
			if(!(process.type.indexOf('video') + 1)){
				if (me.num < obj.list.length) {
					if(process.state == 'play') me.play();
				}else{
					if(!process.persistent) process.task_list();
				}
			}
			//替换为：
			//process.cutoverTask(me, 'video');
			//if (process.state == 'play') me.play();
		}, obj.list[me.num].duration * 1000);
		process.timeout.push(noticeTimer);
		if (me.num == (obj.list.length - 1)) return me.num = 0;
		me.num++; 
	}

}

/**
 * 视频任务执行成员
 */
var video = function() {
	player.init();
	this.lists = {};
	this.persistent = false;
	//节目序号
	this.num = 0;
	this.play = function(){
		//插播使用远程资源，循环播放使用本地已经下载好的资源
		this.persistent ? this.foolPlay() : this.intubatePlay();
	}
	//插播
	this.intubatePlay = function(){
		var me = this;
		//视频播放列表
		var obj = this.lists;
		var url = obj.list[this.num].url;
		var entry = null; 
		//如果当前url不存在，直接播放下一首,
		if (!url || !url.length) {
			this.num++;
			if (obj.list.length > this.num) return me.play(obj);
			//当所有url均为空时，停止video播放
			player.self.stop();
		}
		//指定广告的播放时长
		var duration = obj.list[me.num].duration;
		obj.style.src = server.host + url;
		me.playStart(obj.style);
		var videoTimer = setTimeout(function() {
			clearTimeout(videoTimer);
			process.timeout.remove(clearTimeout,1);
			if (me.num < obj.list.length) {
				if(process.state == 'play') me.play();
			}else{
				if(!process.persistent) process.task_list();
			}
		}, duration * 1000);
		process.timeout.push(videoTimer);
		if ((me.num == (obj.list.length-1)) && process.persistent) return me.num = 0;
		me.num++;
	}
	//循环播放列表
	this.foolPlay = function() {
		var me = this;
		//视频播放列表
		var obj = this.lists;
		var url = obj.list[this.num].url;
		var entry = null; 
		//如果当前url不存在，直接播放下一首,
		if (!url || !url.length) {
			this.num++;
			if (obj.list.length > this.num) return me.play(obj);
			//当所有url均为空时，停止video播放
			player.self.stop();
		}
		//如果url不为空，则判断其对应的本地文件是否存在。
		//如果存在则进行播放
		//如果不存在则需要下载
		//下载期间则播放公司宣传片
		if (!url.match(/(http:)|(https:)/)) url = server.host + url;
		//alert("正在播放视频url："+url);
		var localUrl = server.localUrl(url);
		//console.log("====正在播放："+conf.downloadOption.filename + localUrl);
		console.log("====本地资源绝对路径：" + plus.io.convertLocalFileSystemURL(conf.downloadOption.filename + localUrl));
		
		plus.io.resolveLocalFileSystemURL(conf.downloadOption.filename + localUrl, 
			function(entry) {
				//console.log("====fool本地:" + localUrl);
				//存在则进行播放 
				plus.io.getVideoInfo({
					filePath: conf.downloadOption.filename + localUrl,
					success: function(infor){
						//infor: {resolution:"1280*720",width:"1280",height:"720",size:84758721,duration:"241.80"}
						//如果没有指定广告的播放时长，则以视频的实际播放时长进行播放
						var duration = obj.list[me.num].duration || infor.duration;
						obj.style.src = entry.toRemoteURL();
				
						me.playStart(obj.style);
						var videoTimer = setTimeout(function() {
							clearTimeout(videoTimer);
							process.timeout.remove(clearTimeout,1);
							if (me.num < obj.list.length) {
								if(process.state == 'play'){
									me.play();
								}
							}else{
								if(!process.persistent){
									process.task_list();
								}
							}
						}, duration * 1000);
						process.timeout.push(videoTimer);
						if ((me.num == (obj.list.length-1)) && process.persistent) return me.num = 0;
						me.num++;
					}
				});
			}, 
			function(e) {
				console.log("====error："+JSON.stringify(e));
				plus.io.resolveLocalFileSystemURL(conf.promotionalPath, function(entry){
					//console.log("====正在播放宣传片："+conf.promotionalPath);
					//下载期间则播放公司宣传片
					//如果不存在则播放公司宣传片(按实际播放时长)
					plus.io.getVideoInfo({
						filePath: conf.promotionalPath,
						success: function(infor){
							//infor: {resolution:"1280*720",width:"1280",height:"720",size:84758721,duration:"241.80"}
							obj.style.src = entry.toRemoteURL();
							me.playStart(obj.style);
							var promotionalTimeout = setTimeout(function() {
								clearTimeout(promotionalTimeout);
								process.timeout.remove(promotionalTimeout,1);
								process.task_list();
							//}, infor.duration * 1000);
							}, 10 * 1000);
							process.timeout.push(promotionalTimeout);
						}
					});
				}, function(e) {
					//当宣传片都没有，就只能停下来了。但停下来
					//alert("宣传片都没有，就只能停下来了"+ conf.promotionalPath);
					player.self.stop();
					var nullTimeout = setTimeout(function() {
						clearTimeout(nullTimeout);
						process.timeout.remove(nullTimeout,1);
						if (process.state == 'play') me.play();
					}, conf.nullDataWait * 1000);
					 process.timeout.push(nullTimeout);
				});
			}
		);
	}
	
	this.playStart = function(options){
		player.self.setOptions(options);
		player.self.play();
	}
}

/**
 * 图片任务执行成员
 */
var img = function() {
	var me = this;
	this.lists = {};
	//节目序号
	this.num = 0;
	this.play = function() {
		var obj = me.lists;
		//图片播放列表
		var url = obj.list[me.num] ? obj.list[me.num].url : "";
		if (!url || !url.length) return;
		if (!url.match(/(http:)|(https:)/)) url = server.host + url;
		var localUrl = server.localUrl(url);
		var rurl = conf.downloadOption.filename + localUrl;
		plus.io.resolveLocalFileSystemURL(rurl, 
			function(entry) {
				var absUrl = plus.io.convertLocalFileSystemURL(rurl);
				//console.log("====本地图片："+absUrl);
				$('[data-tag=' + obj.taskTag + ']').find('img').attr('src', "file://" + absUrl);
				var imgTimer = setTimeout(function() {
					clearTimeout(imgTimer);
					process.timeout.remove(imgTimer,1);
					//如果没有视频，则由notice决定切换任务 
					if(!(process.type.indexOf('notice') + 1)){
						if (me.num < obj.list.length) {
							if(process.state == 'play') me.play();
						}else{
							if(!process.persistent) process.task_list();
						}
					}  
					//替换为：
					//process.cutoverTask(me, 'notice');
					//if (process.state == 'play') me.play();
				}, obj.list[me.num].duration * 1000);
				process.timeout.push(imgTimer);
				if (me.num == (obj.list.length - 1)) return me.num = 0;
				me.num++;
			},
			function(e){
				//console.log("====远程图片："+url+JSON.stringify(e));
				$('[data-tag=' + obj.taskTag + ']').find('img').attr('src', url);
				var imgTimer = setTimeout(function() {
					clearTimeout(imgTimer);
					process.timeout.remove(imgTimer,1);
					//如果没有视频，则由notice决定切换任务
					if(!(process.type.indexOf('notice') + 1)){
						if (me.num < obj.list.length) {
							if(process.state == 'play') me.play();
						}else{
							if(!process.persistent) process.task_list();
						}
					}
					// 替换为：
					// process.cutoverTask(me, 'notice');
					//if (process.state == 'play') me.play();
				}, obj.list[me.num].duration * 1000);
				process.timeout.push(imgTimer);
				if (me.num == (obj.list.length - 1)) return me.num = 0;
				me.num++;
			}
		);
	}
}

/**
 * 离线任务管理
 */
var taskManage = {
	//任务执行状态 没执行为 false, 执行过为 true
	state: false,
	ps: 0,
	psId: null,
	srcPath: null,
	successCB: null,
	//初始化
	init: function(failedCB){
		taskManage.failedCB = failedCB;
		//源绝对路径
		taskManage.srcPath = plus.io.convertLocalFileSystemURL(conf.taskManage.srcRoot);
		//app.notice({error: 0, message: "正在检测U盘" + taskManage.srcPath});
		plus.io.resolveLocalFileSystemURL(taskManage.srcPath, function( entry ) {
			//显示复制视图
			views.copying();
			clearInterval(taskManage.psId);
			app.notice({error: 0, message: "U盘已经插入，正在读取数据..."});
			//读取u盘数据
			taskManage.readTask(entry);
		}, taskManage.failedCB)
	},
	// 重启当前的应用
	restartApp: function() {
		console.log("========正在重启===========");
		plus.runtime.restart();
	},
	
	//复制完成
	copyEO: function(){
		alert("数据传输完成，拔出U盘将重启系统！");
	},

	//读取任务列表，任务列表是一个多任务的json配置文件
	//将任务列表中的任务读取并储存到本地缓存中供调用
	readTask: function(entry){
		var directoryReader = entry.createReader();
		directoryReader.readEntries(function(entries){
			taskManage.removeRecursively(function(){
				var i;
				taskManage.ps += entries.length;
				for( i=0; i < entries.length; i++ ) {
					//读取文件内容
					if(entries[i].isFile) taskManage.readFile(entries[i]);
					//拷贝子目录
					if(entries[i].isDirectory){
						taskManage.ps --;
						console.log("当前名称：" + entries[i].name);
						taskManage.copyDirecty(entries[i]);
					}
				}
			})
		}, function ( e ) {
			console.log( "Read entries failed: " + e.message );
		});
	},
	
	//清空目标目录
	removeRecursively: function(successCB){
		plus.io.resolveLocalFileSystemURL(conf.taskManage.targetRoot, function(entry){
			//创建documents目录（确保存在）
			entry.createReader();
			//清空目标目录
			entry.removeRecursively(function(){
				console.log("清空目录成功");
				successCB();
			});
		},function(e){
			console.log(e)
		})
	},
	
	//拷贝数据到目录conf.taskManage.targetRoot
	copyDirecty: function(srcEntry){
		// copy the directory to a new directory and rename it
		plus.io.resolveLocalFileSystemURL(conf.taskManage.targetRoot, function(entry){
			// fs.root是根目录操作对象DirectoryEntry
			// 创建读取目录信息对象 
			var directoryReader = entry.createReader();
			srcEntry.copyTo(entry, srcEntry.name, function(entry){
				console.log("成功复制" + srcEntry.name);
				if(!taskManage.ps) taskManage.copyEO();
			}, function(e){
				console.log(JSON.stringify(e));
			});
		});
	},
	
	//读取文件内容到任务列表
	readFile: function(entrie){
		var reader = null;
		entrie.file(function(file){
			reader = new plus.io.FileReader();
			reader.onloadend = function ( e ) {
				// Get data
				try{
					task = JSON.parse(e.target.result);
				}catch(e){
					app.notice({error: 1, message:"读取任务列表失败"})
				}
				console.log("====data:" + JSON.stringify(task));
				//将任务添加到任务列表
				process.storTask(task); 
				taskManage.ps --;
				if(!taskManage.ps) taskManage.copyEO();
			}
			reader.readAsText( file );
		}, function(e){
			console.log(JSON.stringify(e))
		});
	}
}



/**
 * H5 plus事件处理
 */
function plusReady() {
	test();
	//检测u盘路径是否存在，如果存就拷贝数据，如果不存在就执行回调函数
	taskManage.init(function(){
		//屏幕常亮
		plus.device.setWakelock(true);
		//具备离线播放条件的情况下启动进入离线播放
		process.offlinePlay();
		//创建服务器连接
		//流程:客户端启动完成->拿客户端标识到服务端注册->服务器返回注册完成后的客户端对应的数据表id号->
		//客户端以unid(数据表id)为基准与webSocket服务器建立连接->获取播放任务列表->执行任务->
		//在任务执行节点处将执行结果反馈webSocket服务器->webSocket服务将信息体现在设备状态列表
		var data = {
			mode: plus.device.model,
			vendor: plus.device.vendor == 'Unknown',//虚拟环境可能不存在
			imei: plus.device.imei || 'virtaul',	//虚拟环境可能不存在
			uuid: plus.device.uuid || 'virtaul',	//虚拟环境可能不存在
		};
		if( data.vendor == 'Unknown') data.vendor = 'virtaul';
		data.macid = conf.macid;
		data.sn = $.md5(Object.values(data).join(''));
		views.init();
		//第一次使用，获清空缓存后使用，发起注册请求
		getItem('unid') ? ws.initWs() : server.init(data);
		download.startAll();
	});
}

// 如其名
function test() {
	
	return;
}

