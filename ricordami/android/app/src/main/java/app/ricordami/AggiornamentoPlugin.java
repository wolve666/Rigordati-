package app.ricordami;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * Aggiornamenti fuori dal Play Store: scarica il nuovo APK dalla release di GitHub,
 * controlla l'impronta SHA-256 e apre l'installazione di Android.
 * Android installa l'aggiornamento solo se è firmato con la stessa chiave dell'app installata.
 */
@CapacitorPlugin(name = "Aggiornamento")
public class AggiornamentoPlugin extends Plugin {

    @PluginMethod
    public void info(PluginCall call) {
        try {
            Context c = getContext();
            PackageInfo pi = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            JSObject r = new JSObject();
            r.put("versione", pi.versionName);
            r.put("codice", Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode);
            r.put("puoInstallare", Build.VERSION.SDK_INT < 26 || c.getPackageManager().canRequestPackageInstalls());
            call.resolve(r);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void scaricaEInstalla(PluginCall call) {
        String indirizzo = call.getString("url");
        String atteso = call.getString("sha256", "");
        if (indirizzo == null || !indirizzo.startsWith("https://")) { call.reject("indirizzo non valido"); return; }
        new Thread(() -> {
            HttpURLConnection con = null;
            try {
                File cartella = new File(getContext().getCacheDir(), "aggiornamenti");
                cartella.mkdirs();
                File apk = new File(cartella, "RicordaMi.apk");
                con = (HttpURLConnection) new URL(indirizzo).openConnection();
                con.setInstanceFollowRedirects(true);
                con.setConnectTimeout(15000);
                con.setReadTimeout(30000);
                if (con.getResponseCode() != 200) throw new Exception("download non riuscito (" + con.getResponseCode() + ")");
                long totale = con.getContentLengthLong(), letti = 0;
                int ultimo = -1;
                MessageDigest sha = MessageDigest.getInstance("SHA-256");
                try (InputStream in = con.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[65536];
                    for (int n; (n = in.read(buf)) > 0; ) {
                        out.write(buf, 0, n); sha.update(buf, 0, n); letti += n;
                        int percento = totale > 0 ? (int) (letti * 100 / totale) : -1;
                        if (percento != ultimo) {
                            ultimo = percento;
                            JSObject a = new JSObject(); a.put("percento", percento);
                            notifyListeners("avanzamento", a);
                        }
                    }
                }
                StringBuilder hex = new StringBuilder();
                for (byte b : sha.digest()) hex.append(String.format("%02x", b));
                if (!atteso.isEmpty() && !atteso.equalsIgnoreCase(hex.toString())) {
                    apk.delete();
                    throw new Exception("il file scaricato non è integro, riprova");
                }
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                Intent installa = new Intent(Intent.ACTION_VIEW);
                installa.setDataAndType(uri, "application/vnd.android.package-archive");
                installa.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(installa);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "download non riuscito");
            } finally {
                if (con != null) con.disconnect();
            }
        }).start();
    }
}
