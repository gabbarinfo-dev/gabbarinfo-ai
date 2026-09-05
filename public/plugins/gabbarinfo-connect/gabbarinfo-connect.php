<?php
/**
 * Plugin Name: GabbarInfo AI Connect
 * Plugin URI: https://gabbarinfo.ai/
 * Description: Connects your WordPress & WooCommerce site to GabbarInfo AI for automated Google Ads conversion tracking (gtag.js), Meta Pixel, dynamic purchase tracking, and autonomous SEO & blogging.
 * Version: 1.0.0
 * Author: GabbarInfo AI
 * Author URI: https://gabbarinfo.ai/
 * License: GPL v2 or later
 * Text Domain: gabbarinfo-connect
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Prevent direct access
}

class GabbarInfo_Connect {

    const VERSION = '1.0.0';
    const OPTION_GROUP = 'gabbarinfo_settings_group';

    public function __construct() {
        // Admin menu & settings
        add_action( 'admin_menu', array( $this, 'register_admin_menu' ) );
        add_action( 'admin_init', array( $this, 'register_settings' ) );

        // Header & Footer Tracking Injection
        add_action( 'wp_head', array( $this, 'inject_header_tracking' ), 1 );
        add_action( 'wp_footer', array( $this, 'inject_footer_tracking' ), 99 );

        // WooCommerce Conversion Tracking
        add_action( 'woocommerce_thankyou', array( $this, 'inject_woocommerce_purchase_tracking' ), 20 );

        // REST API Endpoints for Autonomous Agent Control
        add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
    }

    /**
     * Admin Menu under Settings -> GabbarInfo AI Connect
     */
    public function register_admin_menu() {
        add_options_page(
            'GabbarInfo AI Connect',
            'GabbarInfo AI',
            'manage_options',
            'gabbarinfo-connect',
            array( $this, 'render_admin_page' )
        );
    }

    /**
     * Register Plugin Settings in wp_options
     */
    public function register_settings() {
        register_setting( self::OPTION_GROUP, 'gabbarinfo_api_key' );
        register_setting( self::OPTION_GROUP, 'gabbarinfo_google_tag_id' );
        register_setting( self::OPTION_GROUP, 'gabbarinfo_conversion_label' );
        register_setting( self::OPTION_GROUP, 'gabbarinfo_meta_pixel_id' );
        register_setting( self::OPTION_GROUP, 'gabbarinfo_enable_woo_tracking' );
        register_setting( self::OPTION_GROUP, 'gabbarinfo_enable_form_tracking' );
    }

    /**
     * Render the Admin Settings Page in WordPress
     */
    public function render_admin_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        $api_key = get_option( 'gabbarinfo_api_key', '' );
        if ( empty( $api_key ) ) {
            $api_key = 'gb_' . wp_generate_password( 24, false );
            update_option( 'gabbarinfo_api_key', $api_key );
        }

        if ( isset( $_POST['gabbarinfo_action'] ) && $_POST['gabbarinfo_action'] === 'regenerate_key' ) {
            check_admin_referer( 'gabbarinfo_regen_nonce' );
            $api_key = 'gb_sec_' . wp_generate_password( 32, false );
            update_option( 'gabbarinfo_api_key', $api_key );
            echo '<div class="notice notice-success is-dismissible" style="margin-top: 15px;"><p><strong>Pairing Key Regenerated!</strong> Make sure to update the key in your GabbarInfo AI dashboard.</p></div>';
        }

        $google_tag_id = get_option( 'gabbarinfo_google_tag_id', '' );
        $conversion_label = get_option( 'gabbarinfo_conversion_label', '' );
        $meta_pixel_id = get_option( 'gabbarinfo_meta_pixel_id', '' );
        $is_woo = class_exists( 'WooCommerce' );
        ?>
        <div class="wrap" style="max-width: 850px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;">
            <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #fff; padding: 24px 28px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 700;">🚀 GabbarInfo AI Connect</h1>
                        <p style="margin: 8px 0 0; color: #94a3b8; font-size: 14px;">Autonomous Google Ads Tracking, WooCommerce Conversions & AI SEO Engine</p>
                    </div>
                    <span style="background: <?php echo !empty($google_tag_id) ? '#10b981' : '#f59e0b'; ?>; color: #fff; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                        <?php echo !empty($google_tag_id) ? '● Connected' : '● Awaiting Pairing'; ?>
                    </span>
                </div>
            </div>

            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <h2 style="font-size: 18px; margin-top: 0; color: #0f172a;">🔐 AI Agent Pairing Key</h2>
                <p style="color: #64748b; font-size: 14px;">This secret key allows your GabbarInfo AI Agent to automatically inject tags, publish blogs, and optimize website pages.</p>
                <div style="display: flex; gap: 10px; align-items: center; margin-top: 12px; flex-wrap: wrap;">
                    <input type="text" readonly value="<?php echo esc_attr( $api_key ); ?>" style="flex: 1; min-width: 280px; padding: 10px 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; font-family: monospace; font-size: 15px;" id="gabbarinfo_key_input">
                    <button type="button" class="button" onclick="navigator.clipboard.writeText(document.getElementById('gabbarinfo_key_input').value); alert('Pairing Key copied to clipboard!');">Copy Key</button>
                    <form method="post" action="" style="display: inline; margin: 0;">
                        <?php wp_nonce_field( 'gabbarinfo_regen_nonce' ); ?>
                        <input type="hidden" name="gabbarinfo_action" value="regenerate_key">
                        <button type="submit" class="button" onclick="return confirm('Regenerate pairing key? Any existing connection in GabbarInfo AI will need this new key.');">🔄 Regenerate Key</button>
                    </form>
                </div>
            </div>

            <form method="post" action="options.php" style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <?php settings_fields( self::OPTION_GROUP ); ?>
                <h2 style="font-size: 18px; margin-top: 0; color: #0f172a;">📊 Active Tracking Configuration</h2>
                
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="gabbarinfo_google_tag_id">Google Tag ID (gtag.js)</label></th>
                        <td>
                            <input name="gabbarinfo_google_tag_id" type="text" id="gabbarinfo_google_tag_id" value="<?php echo esc_attr( $google_tag_id ); ?>" class="regular-text" placeholder="e.g. AW-123456789 or G-ABC12345">
                            <p class="description">Automatically filled by your GabbarInfo AI agent or entered manually.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="gabbarinfo_conversion_label">Google Ads Conversion Label</label></th>
                        <td>
                            <input name="gabbarinfo_conversion_label" type="text" id="gabbarinfo_conversion_label" value="<?php echo esc_attr( $conversion_label ); ?>" class="regular-text" placeholder="e.g. AbC-dEfGhIjKlM">
                            <p class="description">Used for Google Ads purchase / lead conversion event snippets.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="gabbarinfo_meta_pixel_id">Meta Pixel ID</label></th>
                        <td>
                            <input name="gabbarinfo_meta_pixel_id" type="text" id="gabbarinfo_meta_pixel_id" value="<?php echo esc_attr( $meta_pixel_id ); ?>" class="regular-text" placeholder="e.g. 123456789012345">
                            <p class="description">Optional: Injects Facebook / Meta Pixel tracking across all pages.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">WooCommerce Auto-Tracking</th>
                        <td>
                            <label>
                                <input name="gabbarinfo_enable_woo_tracking" type="checkbox" value="1" <?php checked( '1', get_option( 'gabbarinfo_enable_woo_tracking', '1' ) ); ?> <?php echo !$is_woo ? 'disabled' : ''; ?>>
                                Enable Dynamic Order Value & Revenue Conversion Tracking
                            </label>
                            <p class="description">
                                <?php echo $is_woo ? '🟢 WooCommerce is detected. Tracks order total, currency, and transaction ID on the thank-you page.' : '⚪ WooCommerce is not active on this site.'; ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Form Lead Tracking</th>
                        <td>
                            <label>
                                <input name="gabbarinfo_enable_form_tracking" type="checkbox" value="1" <?php checked( '1', get_option( 'gabbarinfo_enable_form_tracking', '1' ) ); ?>>
                                Automatically track Contact Form 7, WPForms & Elementor Form leads
                            </label>
                        </td>
                    </tr>
                </table>

                <?php submit_button( 'Save Tracking Settings' ); ?>
            </form>
        </div>
        <?php
    }

    /**
     * Inject Google Tag (gtag.js) & Meta Pixel into <head>
     */
    public function inject_header_tracking() {
        $google_tag_id = trim( get_option( 'gabbarinfo_google_tag_id', '' ) );
        $meta_pixel_id = trim( get_option( 'gabbarinfo_meta_pixel_id', '' ) );

        echo "\n<!-- GabbarInfo AI Connect: Active Tracking Header -->\n";
        echo '<meta name="gabbarinfo-connect" content="active" data-version="' . esc_attr( self::VERSION ) . '">' . "\n";

        if ( ! empty( $google_tag_id ) ) {
            ?>
<!-- Global site tag (gtag.js) - Google Ads / Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=<?php echo esc_attr( $google_tag_id ); ?>"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '<?php echo esc_js( $google_tag_id ); ?>', { 'send_page_view': true });
</script>
            <?php
        }

        if ( ! empty( $meta_pixel_id ) ) {
            ?>
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '<?php echo esc_js( $meta_pixel_id ); ?>');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=<?php echo esc_attr( $meta_pixel_id ); ?>&ev=PageView&noscript=1"
/></noscript>
            <?php
        }
        echo "<!-- /GabbarInfo AI Connect -->\n\n";
    }

    /**
     * WooCommerce Thank-You Page Conversion Event
     */
    public function inject_woocommerce_purchase_tracking( $order_id ) {
        if ( ! $order_id ) return;

        $enabled = get_option( 'gabbarinfo_enable_woo_tracking', '1' );
        if ( $enabled !== '1' ) return;

        $google_tag_id = trim( get_option( 'gabbarinfo_google_tag_id', '' ) );
        $conversion_label = trim( get_option( 'gabbarinfo_conversion_label', '' ) );
        $meta_pixel_id = trim( get_option( 'gabbarinfo_meta_pixel_id', '' ) );

        $order = wc_get_order( $order_id );
        if ( ! $order ) return;

        $total = $order->get_total();
        $currency = $order->get_currency();
        $order_num = $order->get_order_number();

        echo "\n<!-- GabbarInfo AI WooCommerce Conversion Tracking -->\n<script>\n";
        
        if ( ! empty( $google_tag_id ) ) {
            if ( ! empty( $conversion_label ) ) {
                $send_to = $google_tag_id . '/' . $conversion_label;
                echo "if (typeof gtag === 'function') {\n";
                echo "  gtag('event', 'conversion', {\n";
                echo "    'send_to': '" . esc_js( $send_to ) . "',\n";
                echo "    'value': " . floatval( $total ) . ",\n";
                echo "    'currency': '" . esc_js( $currency ) . "',\n";
                echo "    'transaction_id': '" . esc_js( $order_num ) . "'\n";
                echo "  });\n";
                echo "}\n";
            }
            echo "if (typeof gtag === 'function') {\n";
            echo "  gtag('event', 'purchase', {\n";
            echo "    'transaction_id': '" . esc_js( $order_num ) . "',\n";
            echo "    'value': " . floatval( $total ) . ",\n";
            echo "    'currency': '" . esc_js( $currency ) . "'\n";
            echo "  });\n";
            echo "}\n";
        }

        if ( ! empty( $meta_pixel_id ) ) {
            echo "if (typeof fbq === 'function') {\n";
            echo "  fbq('track', 'Purchase', {\n";
            echo "    value: " . floatval( $total ) . ",\n";
            echo "    currency: '" . esc_js( $currency ) . "'\n";
            echo "  });\n";
            echo "}\n";
        }

        echo "</script>\n<!-- /GabbarInfo AI WooCommerce Conversion Tracking -->\n\n";
    }

    /**
     * Form Submission Listeners for CF7, WPForms, Elementor
     */
    public function inject_footer_tracking() {
        $enabled = get_option( 'gabbarinfo_enable_form_tracking', '1' );
        if ( $enabled !== '1' ) return;

        $google_tag_id = trim( get_option( 'gabbarinfo_google_tag_id', '' ) );
        $conversion_label = trim( get_option( 'gabbarinfo_conversion_label', '' ) );

        if ( empty( $google_tag_id ) ) return;
        ?>
<script>
document.addEventListener('DOMContentLoaded', function() {
  function trackFormLead(formType) {
    if (typeof gtag === 'function') {
      <?php if ( ! empty( $conversion_label ) ) : ?>
      gtag('event', 'conversion', {
        'send_to': '<?php echo esc_js( $google_tag_id . '/' . $conversion_label ); ?>',
        'value': 1.0,
        'currency': 'INR'
      });
      <?php endif; ?>
      gtag('event', 'generate_lead', { 'event_category': 'form_submit', 'event_label': formType });
    }
    if (typeof fbq === 'function') {
      fbq('track', 'Lead');
    }
  }

  // Contact Form 7
  document.addEventListener('wpcf7mailsent', function() { trackFormLead('Contact Form 7'); }, false);

  // WPForms
  if (window.jQuery) {
    window.jQuery(document).on('wpformsAjaxSubmitSuccess', function() { trackFormLead('WPForms'); });
  }

  // Elementor Forms
  if (window.jQuery) {
    window.jQuery(document).on('submit_success', function() { trackFormLead('Elementor Form'); });
  }
});
</script>
        <?php
    }

    /**
     * Secure REST API Routes for GabbarInfo AI Agent
     */
    public function register_rest_routes() {
        register_rest_route( 'gabbarinfo/v1', '/health', array(
            'methods'  => 'GET',
            'callback' => array( $this, 'rest_get_health' ),
            'permission_callback' => '__return_true',
        ) );

        register_rest_route( 'gabbarinfo/v1', '/sync-tracking', array(
            'methods'  => 'POST',
            'callback' => array( $this, 'rest_sync_tracking' ),
            'permission_callback' => array( $this, 'authenticate_agent_request' ),
        ) );

        register_rest_route( 'gabbarinfo/v1', '/list-content', array(
            'methods'  => 'GET',
            'callback' => array( $this, 'rest_list_content' ),
            'permission_callback' => array( $this, 'authenticate_agent_request' ),
        ) );

        register_rest_route( 'gabbarinfo/v1', '/update-content', array(
            'methods'  => 'POST',
            'callback' => array( $this, 'rest_update_content' ),
            'permission_callback' => array( $this, 'authenticate_agent_request' ),
        ) );

        register_rest_route( 'gabbarinfo/v1', '/create-post', array(
            'methods'  => 'POST',
            'callback' => array( $this, 'rest_create_post' ),
            'permission_callback' => array( $this, 'authenticate_agent_request' ),
        ) );

        register_rest_route( 'gabbarinfo/v1', '/update-seo', array(
            'methods'  => 'POST',
            'callback' => array( $this, 'rest_update_seo' ),
            'permission_callback' => array( $this, 'authenticate_agent_request' ),
        ) );

        register_rest_route( 'gabbarinfo/v1', '/regenerate-key', array(
            'methods'  => 'POST',
            'callback' => array( $this, 'rest_regenerate_key' ),
            'permission_callback' => array( $this, 'authenticate_agent_request' ),
        ) );
    }

    /**
     * Validate Bearer Token against stored Pairing Key
     */
    public function authenticate_agent_request( $request ) {
        $stored_key = get_option( 'gabbarinfo_api_key', '' );
        if ( empty( $stored_key ) ) return false;

        $auth_header = $request->get_header( 'authorization' );
        if ( empty( $auth_header ) ) {
            $param_key = $request->get_param( 'api_key' );
            return ( $param_key === $stored_key );
        }

        if ( preg_match( '/Bearer\s+(.*)$/i', $auth_header, $matches ) ) {
            return ( trim( $matches[1] ) === $stored_key );
        }

        return false;
    }

    /**
     * Sideload image from URL into WordPress Media Library
     */
    private function attach_image_from_url( $image_url, $post_id, $alt_text = '', $title = '' ) {
        if ( empty( $image_url ) ) return false;
        require_once( ABSPATH . 'wp-admin/includes/media.php' );
        require_once( ABSPATH . 'wp-admin/includes/file.php' );
        require_once( ABSPATH . 'wp-admin/includes/image.php' );

        $desc = ! empty( $title ) ? sanitize_text_field( $title ) : ( ! empty( $alt_text ) ? sanitize_text_field( $alt_text ) : 'AI Generated Visual' );
        $attach_id = media_sideload_image( esc_url_raw( $image_url ), $post_id, $desc, 'id' );

        if ( ! is_wp_error( $attach_id ) && $attach_id ) {
            if ( ! empty( $alt_text ) ) {
                update_post_meta( $attach_id, '_wp_attachment_image_alt', sanitize_text_field( $alt_text ) );
            }
            return $attach_id;
        }
        return false;
    }

    /**
     * GET /wp-json/gabbarinfo/v1/health
     */
    public function rest_get_health( $request ) {
        return rest_ensure_response( array(
            'ok'             => true,
            'plugin_version' => self::VERSION,
            'site_url'       => get_site_url(),
            'site_name'      => get_bloginfo( 'name' ),
            'is_woocommerce' => class_exists( 'WooCommerce' ),
            'has_google_tag' => ! empty( get_option( 'gabbarinfo_google_tag_id' ) ),
            'google_tag_id'  => get_option( 'gabbarinfo_google_tag_id', '' ),
            'meta_pixel_id'  => get_option( 'gabbarinfo_meta_pixel_id', '' ),
            'timestamp'      => current_time( 'mysql' ),
        ) );
    }

    /**
     * POST /wp-json/gabbarinfo/v1/sync-tracking
     */
    public function rest_sync_tracking( $request ) {
        $params = $request->get_json_params();
        if ( empty( $params ) ) {
            $params = $request->get_params();
        }

        if ( isset( $params['google_tag_id'] ) ) {
            update_option( 'gabbarinfo_google_tag_id', sanitize_text_field( $params['google_tag_id'] ) );
        }
        if ( isset( $params['conversion_label'] ) ) {
            update_option( 'gabbarinfo_conversion_label', sanitize_text_field( $params['conversion_label'] ) );
        }
        if ( isset( $params['meta_pixel_id'] ) ) {
            update_option( 'gabbarinfo_meta_pixel_id', sanitize_text_field( $params['meta_pixel_id'] ) );
        }

        return rest_ensure_response( array(
            'ok'      => true,
            'message' => 'Tracking parameters updated successfully.',
            'active_settings' => array(
                'google_tag_id'    => get_option( 'gabbarinfo_google_tag_id' ),
                'conversion_label' => get_option( 'gabbarinfo_conversion_label' ),
                'meta_pixel_id'    => get_option( 'gabbarinfo_meta_pixel_id' ),
            ),
        ) );
    }

    /**
     * GET /wp-json/gabbarinfo/v1/list-content (Posts and Pages with full SEO info)
     */
    public function rest_list_content( $request ) {
        $type_param = $request->get_param( 'type' );
        $post_types = ( ! empty( $type_param ) && in_array( $type_param, array( 'post', 'page' ) ) ) ? array( $type_param ) : array( 'post', 'page' );
        $per_page = intval( $request->get_param( 'per_page' ) );
        if ( $per_page <= 0 || $per_page > 100 ) $per_page = 50;

        $query = new WP_Query( array(
            'post_type'      => $post_types,
            'post_status'    => array( 'publish', 'draft', 'pending', 'future' ),
            'posts_per_page' => $per_page,
            'orderby'        => 'date',
            'order'          => 'DESC',
        ) );

        $items = array();
        foreach ( $query->posts as $p ) {
            $thumb_id = get_post_thumbnail_id( $p->ID );
            $thumb_url = $thumb_id ? wp_get_attachment_image_url( $thumb_id, 'full' ) : null;
            $thumb_alt = $thumb_id ? get_post_meta( $thumb_id, '_wp_attachment_image_alt', true ) : '';

            $cats = array();
            if ( $p->post_type === 'post' ) {
                $terms = get_the_category( $p->ID );
                if ( ! empty( $terms ) && ! is_wp_error( $terms ) ) {
                    foreach ( $terms as $t ) {
                        $cats[] = $t->name;
                    }
                }
            }

            $word_count = str_word_count( wp_strip_all_tags( $p->post_content ) );
            $meta_title = get_post_meta( $p->ID, '_yoast_wpseo_title', true ) ?: get_post_meta( $p->ID, 'rank_math_title', true );
            $meta_desc = get_post_meta( $p->ID, '_yoast_wpseo_metadesc', true ) ?: get_post_meta( $p->ID, 'rank_math_description', true );
            $focus_kw = get_post_meta( $p->ID, '_yoast_wpseo_focuskw', true ) ?: get_post_meta( $p->ID, 'rank_math_focus_keyword', true );

            $items[] = array(
                'id'             => $p->ID,
                'title'          => $p->post_title,
                'slug'           => $p->post_name,
                'url'            => get_permalink( $p->ID ),
                'type'           => $p->post_type,
                'status'         => $p->post_status,
                'date'           => $p->post_date,
                'modified'       => $p->post_modified,
                'word_count'     => $word_count,
                'excerpt'        => wp_trim_words( wp_strip_all_tags( $p->post_content ), 35 ),
                'featured_image' => $thumb_url,
                'image_alt'      => $thumb_alt,
                'categories'     => $cats,
                'meta_title'     => $meta_title ?: '',
                'meta_desc'      => $meta_desc ?: '',
                'focus_keyword'  => $focus_kw ?: '',
            );
        }

        return rest_ensure_response( array(
            'ok'    => true,
            'total' => $query->found_posts,
            'items' => $items,
        ) );
    }

    /**
     * POST /wp-json/gabbarinfo/v1/update-content (Optimize Existing Page or Blog)
     */
    public function rest_update_content( $request ) {
        $params = $request->get_json_params();
        if ( empty( $params ) ) $params = $request->get_params();

        $post_id = ! empty( $params['post_id'] ) ? intval( $params['post_id'] ) : 0;
        if ( ! $post_id && ! empty( $params['url'] ) ) {
            $post_id = url_to_postid( esc_url_raw( $params['url'] ) );
        }

        if ( ! $post_id ) {
            return new WP_Error( 'invalid_post', 'Post ID or valid URL required.', array( 'status' => 400 ) );
        }

        $update_data = array( 'ID' => $post_id );
        if ( isset( $params['title'] ) ) {
            $update_data['post_title'] = sanitize_text_field( $params['title'] );
        }
        if ( isset( $params['content'] ) ) {
            $update_data['post_content'] = wp_kses_post( $params['content'] );
        }
        if ( isset( $params['excerpt'] ) ) {
            $update_data['post_excerpt'] = sanitize_text_field( $params['excerpt'] );
        }
        if ( isset( $params['status'] ) && in_array( $params['status'], array( 'publish', 'draft', 'pending' ) ) ) {
            $update_data['post_status'] = $params['status'];
        }

        $res = wp_update_post( $update_data, true );
        if ( is_wp_error( $res ) ) {
            return new WP_Error( 'update_failed', $res->get_error_message(), array( 'status' => 500 ) );
        }

        // Meta SEO Integration
        if ( isset( $params['meta_title'] ) ) {
            $m_title = sanitize_text_field( $params['meta_title'] );
            update_post_meta( $post_id, '_yoast_wpseo_title', $m_title );
            update_post_meta( $post_id, 'rank_math_title', $m_title );
        }
        if ( isset( $params['meta_description'] ) ) {
            $m_desc = sanitize_text_field( $params['meta_description'] );
            update_post_meta( $post_id, '_yoast_wpseo_metadesc', $m_desc );
            update_post_meta( $post_id, 'rank_math_description', $m_desc );
        }
        if ( isset( $params['focus_keyword'] ) ) {
            $f_kw = sanitize_text_field( $params['focus_keyword'] );
            update_post_meta( $post_id, '_yoast_wpseo_focuskw', $f_kw );
            update_post_meta( $post_id, 'rank_math_focus_keyword', $f_kw );
        }

        return rest_ensure_response( array(
            'ok'        => true,
            'post_id'   => $post_id,
            'url'       => get_permalink( $post_id ),
            'message'   => 'Content and SEO updated successfully.',
        ) );
    }

    /**
     * POST /wp-json/gabbarinfo/v1/create-post (Autonomous AI Blog/Page Publishing)
     */
    public function rest_create_post( $request ) {
        $params = $request->get_json_params();
        if ( empty( $params ) ) $params = $request->get_params();

        $title     = ! empty( $params['title'] ) ? sanitize_text_field( $params['title'] ) : 'Untitled AI Article';
        $content   = ! empty( $params['content'] ) ? wp_kses_post( $params['content'] ) : '';
        $status    = ! empty( $params['status'] ) && in_array( $params['status'], array( 'publish', 'draft' ) ) ? $params['status'] : 'publish';
        $post_type = ! empty( $params['post_type'] ) && in_array( $params['post_type'], array( 'post', 'page' ) ) ? sanitize_key( $params['post_type'] ) : 'post';
        $slug      = ! empty( $params['slug'] ) ? sanitize_title( $params['slug'] ) : '';

        // In-content secondary image injection if supplied and not already in HTML
        if ( ! empty( $params['mid_image_url'] ) && strpos( $content, $params['mid_image_url'] ) === false ) {
            $mid_alt = ! empty( $params['mid_image_alt'] ) ? esc_attr( $params['mid_image_alt'] ) : esc_attr( $title );
            $mid_html = "\n<figure class=\"gabbarinfo-mid-image\" style=\"margin: 28px 0; text-align: center;\"><img src=\"" . esc_url( $params['mid_image_url'] ) . "\" alt=\"" . $mid_alt . "\" style=\"max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.1);\" /><figcaption style=\"font-size: 13px; color: #64748b; margin-top: 6px;\">" . $mid_alt . "</figcaption></figure>\n";
            
            // Insert in the middle of content (after 2nd </p> or half-way)
            $p_splits = explode( '</p>', $content );
            if ( count( $p_splits ) > 3 ) {
                $half = intval( floor( count( $p_splits ) / 2 ) );
                $p_splits[$half] .= $mid_html;
                $content = implode( '</p>', $p_splits );
            } else {
                $content .= $mid_html;
            }
        }

        $post_arr = array(
            'post_title'   => $title,
            'post_content' => $content,
            'post_status'  => $status,
            'post_type'    => $post_type,
            'post_author'  => 1,
        );
        if ( ! empty( $slug ) ) {
            $post_arr['post_name'] = $slug;
        }

        $post_id = wp_insert_post( $post_arr );

        if ( is_wp_error( $post_id ) ) {
            return new WP_Error( 'post_creation_failed', $post_id->get_error_message(), array( 'status' => 500 ) );
        }

        // Attach Featured Image if supplied
        $featured_attach_id = null;
        if ( ! empty( $params['featured_image_url'] ) ) {
            $alt_text = ! empty( $params['featured_image_alt'] ) ? $params['featured_image_alt'] : $title;
            $featured_attach_id = $this->attach_image_from_url( $params['featured_image_url'], $post_id, $alt_text, $title );
            if ( $featured_attach_id ) {
                set_post_thumbnail( $post_id, $featured_attach_id );
            }
        }

        // Meta SEO Integration (Yoast / Rank Math / Native)
        if ( ! empty( $params['meta_title'] ) ) {
            $m_title = sanitize_text_field( $params['meta_title'] );
            update_post_meta( $post_id, '_yoast_wpseo_title', $m_title );
            update_post_meta( $post_id, 'rank_math_title', $m_title );
        }
        if ( ! empty( $params['meta_description'] ) ) {
            $m_desc = sanitize_text_field( $params['meta_description'] );
            update_post_meta( $post_id, '_yoast_wpseo_metadesc', $m_desc );
            update_post_meta( $post_id, 'rank_math_description', $m_desc );
        }
        if ( ! empty( $params['focus_keyword'] ) ) {
            $f_kw = sanitize_text_field( $params['focus_keyword'] );
            update_post_meta( $post_id, '_yoast_wpseo_focuskw', $f_kw );
            update_post_meta( $post_id, 'rank_math_focus_keyword', $f_kw );
        }

        return rest_ensure_response( array(
            'ok'          => true,
            'post_id'     => $post_id,
            'post_url'    => get_permalink( $post_id ),
            'status'      => $status,
            'title'       => $title,
            'featured_id' => $featured_attach_id,
        ) );
    }

    /**
     * POST /wp-json/gabbarinfo/v1/update-seo
     */
    public function rest_update_seo( $request ) {
        $params = $request->get_json_params();
        if ( empty( $params ) ) $params = $request->get_params();

        $post_id = ! empty( $params['post_id'] ) ? intval( $params['post_id'] ) : 0;
        if ( ! $post_id && ! empty( $params['url'] ) ) {
            $post_id = url_to_postid( esc_url_raw( $params['url'] ) );
        }

        if ( ! $post_id ) {
            return new WP_Error( 'invalid_post', 'Post ID or valid URL not found.', array( 'status' => 400 ) );
        }

        if ( ! empty( $params['meta_title'] ) ) {
            $m_title = sanitize_text_field( $params['meta_title'] );
            update_post_meta( $post_id, '_yoast_wpseo_title', $m_title );
            update_post_meta( $post_id, 'rank_math_title', $m_title );
        }
        if ( ! empty( $params['meta_description'] ) ) {
            $m_desc = sanitize_text_field( $params['meta_description'] );
            update_post_meta( $post_id, '_yoast_wpseo_metadesc', $m_desc );
            update_post_meta( $post_id, 'rank_math_description', $m_desc );
        }
        if ( ! empty( $params['focus_keyword'] ) ) {
            $f_kw = sanitize_text_field( $params['focus_keyword'] );
            update_post_meta( $post_id, '_yoast_wpseo_focuskw', $f_kw );
            update_post_meta( $post_id, 'rank_math_focus_keyword', $f_kw );
        }

        return rest_ensure_response( array(
            'ok'       => true,
            'post_id'  => $post_id,
            'message'  => 'SEO meta tags updated successfully.',
        ) );
    }

    /**
     * POST /wp-json/gabbarinfo/v1/regenerate-key
     */
    public function rest_regenerate_key( $request ) {
        $new_key = 'gb_sec_' . wp_generate_password( 32, false );
        update_option( 'gabbarinfo_api_key', $new_key );

        return rest_ensure_response( array(
            'ok'      => true,
            'message' => 'Pairing key regenerated successfully.',
            'new_key' => $new_key,
        ) );
    }
}

new GabbarInfo_Connect();

