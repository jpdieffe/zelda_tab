package com.jpdieffe.fairylink;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.os.Build;
import android.os.Bundle;
import android.net.Uri;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public final class MainActivity extends Activity {
  private static final String GAME = "https://jpdieffe.github.io/zelda_tab/?tablet=1";
  private WebView web;
  private boolean locked;
  private boolean refreshOnResume;

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    web = new WebView(this);
    WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0);
    web.setBackgroundColor(0xff102c29);
    WebSettings settings = web.getSettings();
    // Game updates are served at stable URLs. Do not reuse an old HTML/JS
    // bundle when opening the app after a deployment.
    settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
    web.clearCache(true);
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setSupportZoom(false);
    web.setWebChromeClient(new WebChromeClient());
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        // Keep the native bridge on this project's HTTPS pages only.
        Uri u = request.getUrl();
        boolean trusted = "https".equals(u.getScheme()) && "jpdieffe.github.io".equals(u.getHost()) && u.getPath()!=null && u.getPath().startsWith("/zelda_tab/");
        return !trusted;
      }
      @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (request.isForMainFrame()) new AlertDialog.Builder(MainActivity.this)
          .setTitle("Could not open Fairy Link")
          .setMessage("Connect this tablet to Wi-Fi, then retry.")
          .setPositiveButton("Retry", (dialog, which) -> web.loadUrl(GAME))
          .setCancelable(false).show();
      }
      @Override public void onPageFinished(WebView view, String url) { hideBars(); }
    });
    web.addJavascriptInterface(new TabletControls(), "FairyAndroid");
    web.setOnLongClickListener(v -> true);
    web.setLongClickable(false);
    setContentView(web);
    hideBars();
    web.loadUrl(GAME);
  }

  public final class TabletControls {
    @JavascriptInterface public void setLocked(boolean value) {
      runOnUiThread(() -> {
        locked = value;
        try {
          if (value && !isPinned()) startLockTask();
          else if (!value && isPinned()) stopLockTask();
        } catch (RuntimeException error) {
          Toast.makeText(MainActivity.this,"Android could not pin the app. Enable App pinning in tablet Settings and try again.",Toast.LENGTH_LONG).show();
        }
        hideBars();
      });
    }
    @JavascriptInterface public boolean isPinned() {
      ActivityManager manager = (ActivityManager)getSystemService(ACTIVITY_SERVICE);
      return manager.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
    }
  }

  @Override public void onBackPressed() {
    if (locked) return;
    new AlertDialog.Builder(this).setTitle("Close Fairy Link?")
      .setNegativeButton("Keep playing",null)
      .setPositiveButton("Close",(dialog,which)->finish()).show();
  }
  @Override public void onWindowFocusChanged(boolean focus) { super.onWindowFocusChanged(focus); if(focus)hideBars(); }
  @Override protected void onStop() { super.onStop();refreshOnResume=true; }
  @Override protected void onResume() {
    super.onResume();hideBars();
    if(refreshOnResume&&web!=null){
      refreshOnResume=false;
      // Reopening from Home can resume the existing Activity. Refresh idle
      // pairing screens, but preserve a live game or a connection in progress.
      web.evaluateJavascript("(function(){var setup=document.getElementById('jj-setup'),join=document.getElementById('join');if(setup&&!setup.hidden&&join&&!join.disabled)location.reload();})()",null);
    }
  }
  private void hideBars() {
    if (Build.VERSION.SDK_INT >= 30) {
      getWindow().setDecorFitsSystemWindows(false);
      WindowInsetsController c = getWindow().getInsetsController();
      if(c!=null){c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);c.hide(WindowInsets.Type.systemBars());}
    } else {
      getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
        View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
        View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }
  }
  @Override protected void onDestroy() { if(web!=null){web.removeJavascriptInterface("FairyAndroid");web.destroy();}super.onDestroy(); }
}
