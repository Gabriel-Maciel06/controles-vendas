package com.isapel.prospecmobile

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast

/**
 * Prospec Mobile — Native Android Main Activity (Kotlin)
 * Sistema de Prospecção Nativo com acionamento do Discador Android via Intent.ACTION_DIAL
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Criar WebView Nativa em Tela Cheia com Ponte de Código Kotlin
        webView = WebView(this)
        setContentView(webView)

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true

        // Cliente Nativo para interceptar chamadas de telefone
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                if (url != null && (url.startsWith("tel:") || url.startsWith("whatsapp:"))) {
                    try {
                        // Acionar o Discador Nativo do Celular Android
                        val intent = Intent(Intent.ACTION_DIAL, Uri.parse(url))
                        startActivity(intent)
                        Toast.makeText(applicationContext, "Abrindo discador telefônico...", Toast.LENGTH_SHORT).show()
                    } catch (e: Exception) {
                        Toast.makeText(applicationContext, "Erro ao abrir discador: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                    return true
                }
                return false
            }
        }

        // Carregar a aplicação de prospecção
        webView.loadUrl("https://controles-vendas.vercel.app/prospec-mobile.html")
    }

    /**
     * Executa a discagem telefônica nativa diretamente no Android OS
     */
    fun makeNativeCall(phoneNumber: String) {
        val cleanNumber = phoneNumber.replace(Regex("[^0-9+]"), "")
        val dialIntent = Intent(Intent.ACTION_DIAL).apply {
            data = Uri.parse("tel:$cleanNumber")
        }
        startActivity(dialIntent)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
