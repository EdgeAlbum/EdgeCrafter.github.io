<template>
  <div style="height: 100%; overflow-y: auto;" @scroll="handleScroll">
    <div class="cnav" style="pointer-events: none;">
      <div :class="['title', 'left', sidebar_shown_pc?'':'sidebar-hidden']">
        <span class="title-text">{{ album_friendly_name }}</span>
      </div>
      <div class="title right">
        <span style="color: #eee; margin-right: 10px;">{{ photo_count }}张图片</span>
        <span style="pointer-events: auto;"><button @click="menu_more_is_shown = !menu_more_is_shown" style="">...</button></span>
        
        <!-- 弹出的菜单 -->
        <div style="pointer-events: auto;" class="context-menu-mask" v-show="menu_more_is_shown" @click="menu_more_is_shown = false"></div>
        <div :class="['context-menu', menu_more_is_shown?'shown':'hidden']" v-show="menu_more_is_shown" style="pointer-events: auto; top: 56px; right: 20px">
          <a
            @click="current_zoom_scale < 2 && ((current_zoom_scale++), (menu_more_is_shown = false))"
            :aria-disabled="current_zoom_scale >= 2">放大</a>
          <a
            @click="current_zoom_scale > -6 && ((current_zoom_scale--), (menu_more_is_shown = false))"
            :aria-disabled="current_zoom_scale <= -6">缩小</a>
          <a
            @click="current_zoom_scale != 0 && ((current_zoom_scale = 0), (menu_more_is_shown = false))"
            :aria-disabled="current_zoom_scale == 0">默认缩放 (当前：{{ current_zoom_scale }})</a>
          <hr v-show="base_name === '_fav'" />
          <a v-show="base_name === '_fav'"
            @click="exportFavClick()">导出个人收藏</a>
          <a v-show="base_name === '_fav'"
            @click="importFavClick()">导入个人收藏</a>
        </div>
      </div>

      <!-- 手机的上一页按钮-->
      <div class="back left" style="line-height:45px; left: 18px; top: 0" @click="raise_event_show_sidebar(true, 'mobile')">
        <i class="larrow" style="border-color: white"></i><span class="backtext">照片</span>
      </div>

      <!-- 电脑端折叠sidebar的恢复按钮 -->
      <div :class="['back', 'left', 'sidebar-hidden-left', sidebar_shown_pc?'':'sidebar-hidden']"
        @click="raise_event_show_sidebar(true, 'pc')" style="line-height:45px; left: 18px; top: 0">
        <span class="backtext">
          <IconBase icon-color="white"> <IconSideBar /> </IconBase>
        </span>
      </div>
    </div>


    <div class="password-container" v-show="!unlocked">
      <PasswordInput ref="password_input" :hint="hint" @submit-password="pwd => checkPassword(pwd)"></PasswordInput>
    </div>
    <div v-show="unlocked">
      <!-- thumbnail -->
      <div :class="['photo', 'box', 'scale-ratio-ratio-' + current_zoom_scale]" v-for="(photo, i) in photo_list" :photo-name="photo.name" :key="i"
          :style="{
            backgroundImage: `url('${ get_thumbnail_image(photo.al, photo.name) }')`,
            backgroundPosition: 'center'
          }"
      >
        <!-- 点开图片 -->
        <div class="photo-mask" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%;"
            @click="raise_event_show_preview(photo.name, photo_list, i, photo.al, photo, password)"
        >
        </div>

        <!-- 收藏按钮 -->
        <!-- <div class="fav-btn" :style="{
                position: 'absolute', left: '20px', bottom: '20px',
                display: photo.fav ? 'block' : ''
              }" @click="switchFavState(photo)" >
          <IconBase icon-color="white" v-if="!photo.fav"> <IconHeart /> </IconBase>
          <IconBase icon-color="white" v-else> <IconHeartFilled /> </IconBase>
        </div> -->
      </div>
    </div>
  </div>
</template>

<script>

import '../css/style.css'
import '../css/contentview.css'
import '../css/content_scale.css'
import '../css/menu.css'
import '../css/dark_theme.css'
import utils from "@/js/utils";
import IconBase from "@/icons/IconBase";
import IconSideBar from "@/icons/IconSideBar";
import IconHeart from "@/icons/IconHeart";
import IconHeartFilled from "@/icons/IconHeartFilled";
import PasswordInput from "@/components/PasswordInput";

const PHOTO_PER_PAGE = 50;

export default {
  name: "Content",
  // eslint-disable-next-line vue/no-unused-components
  components: { IconSideBar, IconBase, IconHeart, IconHeartFilled, PasswordInput },
  props: [ 'base_name', 'album_friendly_name', 'sidebar_shown_pc' ],
  data() {
    return {
      page_count: 0,
      current_page_to_load: 0,
      photo_count: 0,
      photo_list: [],
      initial_scroll_height: 0,
      response_load_new: true,
      fav_content_cache: {},
      fav_page_cache: null,
      menu_more_is_shown: false,
      current_zoom_scale: 0,
      secret: false,
      unlocked: true,
      hint: '',
      password: '',
    }
  },
  computed: {
    album_get_meta_json_name() {
      return `${this.base_name}/meta`;
    },
    album_get_image_at_current_page_json_name() {
      return this.base_name + `/page_` + String(this.current_page_to_load);
    }
  },
  watch: {
    base_name() {
      this.initialize();
    },
  },
  created() {},
  async mounted() {
    this.initialize();
  },
  methods: {
    async checkPassword(password) {
      // console.log('base_name:', this.base_name)
      // console.log(password);
      try {
        const probe = await utils.get_json(this.base_name + `/${password}/probe`);
        if(probe) {
          // console.log('ok');
          const key = JSON.parse(localStorage.getItem('key') || '{}');
          key[this.base_name] = password;
          localStorage.setItem('key', JSON.stringify(key));
          this.$refs.password_input.feedback(true);
          this.password = password;
          this.unlocked = true;
          return true;
        } else {
          this.password = '';
          this.$refs.password_input.feedback(false);
          return false;
        }
      } catch (err) {
        console.log(err);
        this.$refs.password_input.feedback(false);
        return false;
      }
      
    },
    raise_event_show_sidebar(val, mode) {
      this.$emit('should-show-sidebar', val, mode);
    },
    raise_event_show_preview(image_file_name, photo_list, photo_index, album_name, photo_obj, password) {
      this.$emit('preview-photo', image_file_name, photo_list, photo_index, album_name, photo_obj, password);
    },
    async load_image() {
      // console.log("load album:", this.album_get_meta_json_name)
      if (!this.response_load_new) {
        return;
      }
      this.response_load_new = false;
      setTimeout(() => { this.response_load_new = true; }, 1000)
      if (this.current_page_to_load >= this.page_count) {
        this.response_load_new = true;
        return;
      }
      if (this.album_get_meta_json_name.startsWith("_fav")) {
        let max_i = Math.min(this.photo_list.length + PHOTO_PER_PAGE, this.fav_page_cache.length);
        for (let i=this.photo_list.length; i < max_i; i++) {
          this.photo_list.push(this.fav_page_cache[i]);
        }
      } else {
        this.photo_list.push(...await utils.get_json(this.album_get_image_at_current_page_json_name));
        this.applyFavoriteWithPhotos(); // TODO: 性能优化：先执行着一条语句再加入photolist
      }

      this.current_page_to_load++;
      this.response_load_new = true;
    },
    get_thumbnail_image(alumn_name ,image_name) {
      return `${utils.publicPath}/api/${alumn_name}/${this.password ? `${this.password}_` : ''}cache/${image_name}`;
    },

    async initialize() {
      if (!this.base_name)
        return;

      this.current_page_to_load = 0;
      this.photo_list = [];
      this.response_load_new = true;
      this.initial_scroll_height = 0;
      this.photo_count = this.page_count = 0;

      // get page count
      // console.log("get photo count: ", this.album_get_meta_json_name);
      if (this.album_get_meta_json_name.startsWith("_fav")) {
        // not loaded
        if (this.fav_page_cache == null || this.current_page_to_load == 0) {
          this.fav_page_cache = [];
          this.loadAllFavoriteItems();
          // console.log(this.fav_content_cache)
          for (let key1 in this.fav_content_cache) {
            // console.log(key1)
            for (let key2 in this.fav_content_cache[key1]) {
              this.fav_page_cache.push(this.fav_content_cache[key1][key2]);
            }
          }
        }
        this.photo_count = this.fav_page_cache.length;

        // console.log("-- Favorite album count:", this.photo_count);
      } else { // get normal album
        const album_config = (await utils.get_json(this.album_get_meta_json_name));
        this.photo_count = album_config.count;
        this.secret = album_config.secret;
        this.hint = album_config.hint;
        this.unlocked = true;
        this.password = '';
        if(album_config.secret === true) { // 加密相册
          // 读取localStorage中的密码，如果解不开就false
          const key = JSON.parse(localStorage.getItem('key') || '{}');
          if (key[this.base_name] === undefined) {
            this.$refs.password_input.refresh();
            this.unlocked = false;
          } else {
            const result = await this.checkPassword(key[this.base_name]);
            if(result === false) {
              this.$refs.password_input.refresh();
              this.unlocked = false;
            }
          }
        }
      }
      //this.photo_count = this.get_page_count(this.album_get_meta_json_name);
      this.page_count = Math.ceil(this.photo_count / PHOTO_PER_PAGE);

      // load page 0 first
      if (this.page_count > 0) {
        const args = await utils.parse_args();
        if(args.i) { // 解决多线程异步竞争导致 page_0 被 default 抢先加载消耗 count++ 的问题
          setTimeout(()=>{
            this.load_image();
          }, 10);
        } else {
          this.load_image();
        }
      }
    },
    handleScroll: function(el) {
      if (this.initial_scroll_height === 0)
        this.initial_scroll_height = el.srcElement.scrollHeight / 10;
      if((el.srcElement.offsetHeight + el.srcElement.scrollTop) >= el.srcElement.scrollHeight - this.initial_scroll_height) {
        this.load_image()
      }
    },

    // Favorite
    isFavorite(photo) {
      return photo.fav
    },

    // 用于获取收藏夹对应的key
    getFavoriteStorageKey(photo) {
      return `${photo.al}/${photo.name}`;
    },

    // 用于获取localStorage对应的key
    getFavoriteLocalStorageKey(photo) {
      return `fav_${photo.al}`;
    },

    // 用于获取localStorage中所有的key
    getFavoriteLocalStorageAllKeys() {
      let keys = []
      for (let i = 0, len = localStorage.length; i < len ; ++i) {
        let _key = localStorage.key(i);
        if (_key.startsWith("fav_"))
          keys.push(_key);
      }
      return keys;
    },

    loadAllFavoriteItems() {
      this.fav_content_cache = {};
      let keys = this.getFavoriteLocalStorageAllKeys();
      // console.log(keys)
      for (let i = 0; i < keys.length; i++) {
        this.fav_content_cache[keys[i]] = JSON.parse(localStorage.getItem(keys[i]));
      }
    },

    applyFavoriteWithPhotos() {
      this.loadAllFavoriteItems();
      for (let i=0; i<this.photo_list.length; i++) {
        let key = this.getFavoriteStorageKey(this.photo_list[i]);
        let al_key = this.getFavoriteLocalStorageKey(this.photo_list[i]);
        if (typeof this.fav_content_cache[al_key] == "undefined")
          continue;
        if (typeof this.fav_content_cache[al_key][key] == "undefined")
          continue;
        this.photo_list[i].fav = true;
        // console.log('-- Favorite item:', key);
      }
      this.$forceUpdate();
    },

    saveFavoriteState(photo) {
      let key = this.getFavoriteStorageKey(photo);
      let al_key = this.getFavoriteLocalStorageKey(photo);
      if (typeof this.fav_content_cache[al_key] == "undefined") {
        this.fav_content_cache[al_key] = {}
      }
      if (photo.fav) {
        // Add to favorite
        this.fav_content_cache[al_key][key] = photo;
      }
      else {
        // Remove from favorite
        delete this.fav_content_cache[al_key][key];
      }
      let localstorage = window.localStorage;
      if (typeof localstorage === "undefined") {
        alert('您的浏览器不支持localStorage，无法使用此功能！');
        return;
      }
      // Save as <key, value> to local storage
      localstorage.setItem(
          al_key,
          JSON.stringify(this.fav_content_cache[al_key]));
    },

    switchFavState(photo) {
      photo.fav = !photo.fav;
      this.$forceUpdate();
      this.saveFavoriteState(photo)
    },

    exportFavClick() {
      this.menu_more_is_shown = false;
      let keys = this.getFavoriteLocalStorageAllKeys();
      console.log("export fav:", keys);
      let save_content = {};
      for (let i = 0; i < keys.length; i++) {
        save_content[keys[i]] = localStorage.getItem(keys[i]);
      }
      let filename = "export_" + utils.get_current_time_f() + ".json"
      utils.download_text_as_file(JSON.stringify(save_content), filename);
    },

    async importFavClick() {
      this.menu_more_is_shown = false;

      function _check(o) {
        if (typeof o === "undefined") {
          throw new Error("object is undefined");
        }
      }

      try {
        let fav_json = await utils.get_file_content(".json")
        fav_json = JSON.parse(fav_json)
        console.log(fav_json);

        // Check if is valid favorite
        let fav = {};
        let k0 = Object.keys(fav_json);
        console.log(k0)
        for (let i=0; i<k0.length; i++) {
          let fal = JSON.parse(fav_json[k0[i]]);

          // check for each item
          let falk = Object.keys(fal);
          for (let j=0; j < falk.length; j++) {
            let al = fal[falk[j]];
            // console.log(al)
            _check(al["al"])
            _check(al["name"])
            _check(al["h"])
            _check(al["w"])
            _check(al["ct"])
          }
        }

        for (let i=0; i<k0.length; i++) {
          let fal = fav_json[k0[i]];
          console.log("Import favorite: ", k0[i], fal)
          window.localStorage.setItem(k0[i], fal);
        }

        this.initialize(); // reload favorite
      }
      catch (err) {
        console.log(err);
        alert("选择的文件无法识别！");
      }

    }
  }
}

</script>

<style scoped>
.fav-btn {
  display: none;
  cursor: pointer;
}

.photo-mask:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.photo.box:hover >.fav-btn {
  display: block;
}

div.dialog-container {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  height: 100%;
  width: 100%;
  z-index: 19999;
}

button.large_button {
  width: 100px;
}

button.primary_btn,
button.primary_btn:hover {
  border: 1px solid #5555ff;
  background-color: #5555ff;
}
button.primary_btn:active {
  border: 1px solid #000088 !important;
  background-color: #000088 !important;
}

@media screen and (max-width: 500px) {
  button.large_button {
    width: 100%;
  }
  button.primary_btn,
  button.primary_btn:hover {
    border: 1px solid #eee !important;
    background-color: #eee !important;
  }
  button.primary_btn:active {
    border: 1px solid #ddd !important;
    background-color: #ddd !important;
  }

  .mbutton-group {
    border-radius: 6px;
  }
}
</style>